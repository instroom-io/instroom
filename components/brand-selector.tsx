"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { signOut } from "next-auth/react"
import Script from "next/script"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Zap, AlertCircle, Check, ChevronDown, LogOut, Users } from "lucide-react"
import { WorkspaceUnavailableModal } from "@/components/workspace-unavailable-modal"

interface Brand {
  id: string
  name: string
  slug: string
  logo_url: string | null
  isOwner: boolean
  subscriptionActive: boolean
}

interface BuyBrandsModalState {
  isOpen: boolean
  maxBrandsAvailable: number
  pricePerBrand: number
  currentExtraBrands: number
  maxTotalBrands: number
}

interface DropdownPosition {
  top: number
  right: number
}

export function BrandSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBrandId, setSelectedBrandId] = useState<string>("")
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition>({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [buyBrandsModal, setBuyBrandsModal] = useState<BuyBrandsModalState>({
    isOpen: false,
    maxBrandsAvailable: 0,
    pricePerBrand: 0,
    currentExtraBrands: 0,
    maxTotalBrands: 0,
  })
  const [brandsToAdd, setBrandsToAdd] = useState(1)
  const [buyingBrands, setBuyingBrands] = useState(false)
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const paypalRef = useRef<HTMLDivElement>(null)

  const [unavailableModalOpen, setUnavailableModalOpen] = useState(false)
  const [unavailableBrand, setUnavailableBrand] = useState<Brand | null>(null)

  const handleUnavailableModalClose = () => {
    setUnavailableModalOpen(false)
    setDropdownOpen(false)
    const availableBrand = brands.find(b => b.subscriptionActive)
    if (availableBrand) {
      setSelectedBrandId(availableBrand.id)
      const params = new URLSearchParams()
      params.set("brandId", availableBrand.id)
      router.push(`${pathname}?${params.toString()}`)
    } else {
      router.push("/dashboard")
    }
  }

  useEffect(() => {
    setMounted(true)
    const params = new URLSearchParams(window.location.search)
    const brandId = params.get("brandId")

    const fetchBrands = async () => {
      try {
        const response = await fetch("/api/brand/list")
        if (response.ok) {
          const data = await response.json()
          setBrands(data.brands)
          if (brandId) {
            setSelectedBrandId(brandId)
          } else if (data.brands.length > 0) {
            setSelectedBrandId(data.brands[0].id)
            const newParams = new URLSearchParams()
            newParams.set("brandId", data.brands[0].id)
            router.push(`${pathname}?${newParams.toString()}`)
          }
        }
      } catch (error) {
        // Failed to fetch brands
      } finally {
        setLoading(false)
      }
    }

    fetchBrands()
  }, [pathname, router])

  // Close on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownOpen])

  // Anchor dropdown to the right edge of the trigger (right-aligned)
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    })
  }, [])

  useEffect(() => {
    if (dropdownOpen) {
      updatePosition()
      window.addEventListener("scroll", updatePosition, true)
      window.addEventListener("resize", updatePosition)
      return () => {
        window.removeEventListener("scroll", updatePosition, true)
        window.removeEventListener("resize", updatePosition)
      }
    }
  }, [dropdownOpen, updatePosition])

  const handleToggleDropdown = () => {
    if (!dropdownOpen) updatePosition()
    setDropdownOpen(prev => !prev)
  }

  const checkBrandLimitAndBuy = async () => {
    try {
      setError("")
      const res = await fetch("/api/subscription/check-brand-limit")
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to check brand limit"); return }
      if (data.canBuyMore) {
        setBuyBrandsModal({
          isOpen: true,
          maxBrandsAvailable: data.maxBrandsAvailable,
          pricePerBrand: data.pricePerBrand,
          currentExtraBrands: data.currentExtraBrands,
          maxTotalBrands: data.maxTotalBrands,
        })
        setBrandsToAdd(1)
        setError("")
      } else if (data.allowed) {
        router.push("/dashboard/brand/create")
      } else {
        setError(data.message || "You've reached your brand limit and cannot purchase more.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  useEffect(() => {
    if (!buyBrandsModal.isOpen || !paypalLoaded || !paypalRef.current) return
    if (paypalRef.current.innerHTML !== "") return
    if (window.paypal) {
      const button = window.paypal.Buttons({
        style: { shape: "pill", color: "blue", layout: "vertical", label: "pay" },
        createOrder: async (data: any) => {
          try {
            const totalAmount = (buyBrandsModal.pricePerBrand * brandsToAdd).toFixed(2)
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: totalAmount, description: `${brandsToAdd} extra brand(s)` }),
            })
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || "Failed to create payment order")
            }
            const orderData = await response.json()
            if (!orderData.id) throw new Error("No order ID returned from server")
            return orderData.id
          } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to create payment order")
            throw error
          }
        },
        onApprove: async (data: any) => {
          try {
            setBuyingBrands(true)
            const response = await fetch("/api/subscription/buy-extra-brands", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: brandsToAdd, paypalOrderId: data.orderID }),
            })
            const result = await response.json()
            if (!response.ok) {
              setError(result.details ? `${result.error}: ${result.details}` : result.error || "Failed to complete purchase")
              setBuyingBrands(false)
              return
            }
            setBuyBrandsModal({ ...buyBrandsModal, isOpen: false })
            setBrandsToAdd(1)
            setError("")
            router.push("/dashboard/brand/create")
          } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setBuyingBrands(false)
          }
        },
        onError: () => { setError("Payment failed. Please try again."); setBuyingBrands(false) },
      })
      button.render(paypalRef.current)
    }
  }, [buyBrandsModal.isOpen, buyBrandsModal.pricePerBrand, paypalLoaded])

  if (!mounted || loading) {
    return <div className="h-8 w-36 animate-pulse rounded-lg bg-gray-100" />
  }

  if (brands.length === 0) {
    return (
      <button
        onClick={() => router.push("/dashboard/brand/create")}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <Plus className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-700 font-medium">Create Workspace</span>
      </button>
    )
  }

  const currentBrand = brands.find((b) => b.id === selectedBrandId)
  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  const ownedBrands = brands.filter((b) => b.isOwner)
  const sharedBrands = brands.filter((b) => !b.isOwner)
  const userName = session?.user?.name || "User"
  const userAvatar = session?.user?.image || "/avatars/default.jpg"

  // Dropdown via portal — right-aligned to trigger, escapes any overflow clipping
  const dropdown = (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropdownPos.top,
        right: dropdownPos.right,
        width: 260,
        zIndex: 9999,
      }}
      className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
    >
      {/* Team */}
      <div className="px-3 py-2">
        <button
          onClick={() => { router.push("/dashboard/settings/collaborators"); setDropdownOpen(false) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-gray-900">Team</p>
            <p className="text-xs text-gray-400">Team settings</p>
          </div>
        </button>
      </div>

      <div className="h-px bg-gray-100 mx-3" />

      {/* Owned Workspaces */}
      {ownedBrands.length > 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1">
            Workspaces
          </p>
          <div className="space-y-0.5">
            {ownedBrands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => {
                  if (!brand.subscriptionActive && !brand.isOwner) {
                    setUnavailableBrand(brand); setUnavailableModalOpen(true); return
                  }
                  setSelectedBrandId(brand.id)
                  const params = new URLSearchParams()
                  params.set("brandId", brand.id)
                  router.push(`${pathname}?${params.toString()}`)
                  setDropdownOpen(false)
                }}
                disabled={!brand.subscriptionActive && !brand.isOwner}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  !brand.subscriptionActive && !brand.isOwner
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50"
                }`}
              >
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt={brand.name}
                    className={`h-8 w-8 rounded-md flex-shrink-0 object-cover ${!brand.subscriptionActive && !brand.isOwner ? "grayscale" : ""}`}
                  />
                ) : (
                  <Avatar className="h-8 w-8 rounded-md flex-shrink-0">
                    <AvatarFallback className="rounded-md text-xs font-bold bg-gray-100 text-gray-700">
                      {getInitials(brand.name)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{brand.name}</p>
                  <p className="text-xs text-gray-400">
                    {!brand.subscriptionActive && !brand.isOwner ? "⚠️ Unavailable" : "Owner"}
                  </p>
                </div>
                {brand.id === selectedBrandId && (
                  <Check className="h-4 w-4 text-[#0F6B3E] flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add Workspace */}
      <div className={`px-3 ${ownedBrands.length > 0 ? "pb-2" : "py-2"}`}>
        <button
          onClick={() => { checkBrandLimitAndBuy(); setDropdownOpen(false) }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <div className="h-8 w-8 rounded-md border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0">
            <Plus className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <span className="text-sm font-medium text-gray-500">Add Workspace</span>
        </button>
      </div>

      {/* Shared Workspaces */}
      {sharedBrands.length > 0 && (
        <>
          <div className="h-px bg-gray-100 mx-3" />
          <div className="px-3 py-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 pb-1">
              Shared Workspaces
            </p>
            <div className="space-y-0.5">
              {sharedBrands.map((brand) => (
                <button
                  key={brand.id}
                  onClick={() => {
                    if (!brand.subscriptionActive) {
                      setUnavailableBrand(brand); setUnavailableModalOpen(true); return
                    }
                    setSelectedBrandId(brand.id)
                    const params = new URLSearchParams()
                    params.set("brandId", brand.id)
                    router.push(`${pathname}?${params.toString()}`)
                    setDropdownOpen(false)
                  }}
                  disabled={!brand.subscriptionActive}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    !brand.subscriptionActive ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
                  }`}
                >
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt={brand.name}
                      className={`h-8 w-8 rounded-md flex-shrink-0 object-cover ${!brand.subscriptionActive ? "grayscale" : ""}`}
                    />
                  ) : (
                    <Avatar className="h-8 w-8 rounded-md flex-shrink-0">
                      <AvatarFallback className="rounded-md text-xs font-bold bg-gray-100 text-gray-700">
                        {getInitials(brand.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{brand.name}</p>
                    <p className="text-xs text-gray-400">
                      {!brand.subscriptionActive ? "⚠️ Unavailable" : "Member"}
                    </p>
                  </div>
                  {brand.id === selectedBrandId && (
                    <Check className="h-4 w-4 text-[#0F6B3E] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Account + Logout */}
      <div className="h-px bg-gray-100" />
      <div className="px-3 py-2">
        <button
          onClick={() => { router.push("/dashboard/settings"); setDropdownOpen(false) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Avatar className="h-8 w-8 rounded-full flex-shrink-0">
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="text-xs font-bold bg-gray-100 text-gray-700">
              {getInitials(userName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-[#0F6B3E] font-medium">Account settings</p>
          </div>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors mt-0.5"
        >
          <LogOut className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-500">Log out</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 text-red-700 border border-red-200 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Trigger — styled for white topbar */}
      <button
        ref={triggerRef}
        onClick={handleToggleDropdown}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        {currentBrand?.logo_url ? (
          <img
            src={currentBrand.logo_url}
            alt={currentBrand.name}
            className="h-6 w-6 rounded-md flex-shrink-0 object-cover"
          />
        ) : (
          <Avatar className="h-6 w-6 rounded-md flex-shrink-0">
            <AvatarFallback className="rounded-md text-[10px] font-bold bg-[#0F6B3E] text-white">
              {getInitials(currentBrand?.name || "")}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="text-sm font-medium text-gray-800 max-w-[120px] truncate">
          {currentBrand?.name}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Portal dropdown */}
      {mounted && dropdownOpen && createPortal(dropdown, document.body)}

      {/* Buy Extra Brands Modal */}
      {buyBrandsModal.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#1FAE5B]" />
                Buy Extra Workspaces
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                You've reached your workspace limit. Purchase extra workspaces to continue.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
                  <AlertCircle className="h-4 w-4" />{error}
                </div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Current Subscription</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Extra Workspaces Purchased</p>
                    <p className="text-2xl font-bold text-gray-900">{buyBrandsModal.currentExtraBrands}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-muted-foreground">Max Available</p>
                    <p className="text-2xl font-bold text-gray-900">{buyBrandsModal.maxTotalBrands}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="brands">Number of Workspaces</Label>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBrandsToAdd(Math.max(1, brandsToAdd - 1))} disabled={brandsToAdd <= 1 || buyingBrands}>−</Button>
                  <Input id="brands" type="number" min="1" max={buyBrandsModal.maxBrandsAvailable} value={brandsToAdd}
                    onChange={(e) => setBrandsToAdd(Math.min(buyBrandsModal.maxBrandsAvailable, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="text-center" disabled={buyingBrands}
                  />
                  <Button variant="outline" size="sm" onClick={() => setBrandsToAdd(Math.min(buyBrandsModal.maxBrandsAvailable, brandsToAdd + 1))} disabled={brandsToAdd + 1 > buyBrandsModal.maxBrandsAvailable || buyingBrands}>+</Button>
                </div>
                <p className="text-xs text-muted-foreground">You can purchase up to {buyBrandsModal.maxBrandsAvailable} more workspace(s)</p>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Price per workspace:</span>
                  <span className="font-medium">${buyBrandsModal.pricePerBrand.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{brandsToAdd}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Total:</span>
                  <span className="text-lg font-bold text-[#1FAE5B]">${(buyBrandsModal.pricePerBrand * brandsToAdd).toFixed(2)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <Script
                  src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&intent=capture`}
                  strategy="afterInteractive"
                  onLoad={() => setPaypalLoaded(true)}
                />
                <div ref={paypalRef} className="paypal-button-container" />
                <Button variant="outline" onClick={() => { setBuyBrandsModal({ ...buyBrandsModal, isOpen: false }); if (paypalRef.current) paypalRef.current.innerHTML = "" }} disabled={buyingBrands} className="w-full">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <WorkspaceUnavailableModal
        open={unavailableModalOpen}
        onOpenChange={setUnavailableModalOpen}
        onClose={handleUnavailableModalClose}
        workspaceName={unavailableBrand?.name || ""}
      />
    </>
  )
}