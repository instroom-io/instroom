"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, Trash2, Mail, Zap, Loader2 } from "lucide-react"
import Script from "next/script"
import { cn } from "@/lib/utils"

interface Collaborator {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
  joinedAt?: string
}

interface BuySeatsModalState {
  isOpen: boolean
  maxSeatsAvailable: number
  pricePerSeat: number
  currentExtraSeats: number
  maxTotalSeats: number
}

declare global {
  interface Window {
    paypal?: any
  }
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loading</p>
    </div>
  )
}

function CollaboratorsContent() {
  const searchParams = useSearchParams()
  useSession()

  const brandId = searchParams.get("brandId")

  const [owner, setOwner] = useState<Collaborator | null>(null)
  const [members, setMembers] = useState<Collaborator[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const [error, setError] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("manager")
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const [buySeatsModal, setBuySeatsModal] = useState<BuySeatsModalState>({
    isOpen: false,
    maxSeatsAvailable: 0,
    pricePerSeat: 0,
    currentExtraSeats: 0,
    maxTotalSeats: 0,
  })
  const [seatsToAdd, setSeatsToAdd] = useState(1)
  const [buyingSeats, setBuyingSeats] = useState(false)
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const paypalRef = useRef<HTMLDivElement>(null)

  // brandId is read directly from searchParams above — no effect needed.

  useEffect(() => {
    if (!buySeatsModal.isOpen || !paypalLoaded || !paypalRef.current) return
    if (paypalRef.current.innerHTML !== "") return

    if (window.paypal) {
      const button = window.paypal.Buttons({
        style: { shape: "pill", color: "blue", layout: "vertical", label: "pay" },
        createOrder: async (data: any, actions: any) => {
          try {
            const totalAmount = (buySeatsModal.pricePerSeat * seatsToAdd).toFixed(2)
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: totalAmount,
                description: `${seatsToAdd} extra seat(s) for collaborators`,
              }),
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
        onApprove: async (data: any, actions: any) => {
          try {
            setBuyingSeats(true)
            const response = await fetch("/api/subscription/buy-extra-seats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: seatsToAdd, paypalOrderId: data.orderID }),
            })
            const result = await response.json()
            if (!response.ok) {
              const errorMsg = result.details ? `${result.error}: ${result.details}` : result.error
              setError(errorMsg || "Failed to complete purchase")
              setBuyingSeats(false)
              return
            }
            setBuySeatsModal((s) => ({ ...s, isOpen: false }))
            setSeatsToAdd(1)
            setError("")
            if (inviteEmail) {
              const form = new Event("submit")
              handleInvite(form as any)
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setBuyingSeats(false)
          }
        },
        onError: () => {
          setError("Payment failed. Please try again.")
          setBuyingSeats(false)
        },
      })
      button.render(paypalRef.current)
    }
  }, [buySeatsModal.isOpen, buySeatsModal.pricePerSeat, paypalLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!brandId) {
      setDataLoaded(true)
      return
    }

    setDataLoaded(false)

    const fetchCollaborators = async () => {
      try {
        setError("")
        const res = await fetch(`/api/brand/${brandId}/collaborators`)
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 403) setError("You don't have permission to manage collaborators for this brand.")
          else if (res.status === 404) setError("Brand not found.")
          else setError(data.error || "Failed to fetch collaborators")
          return
        }
        setOwner(data.owner)
        setMembers(data.members || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching collaborators")
      } finally {
        setDataLoaded(true)
      }
    }
    fetchCollaborators()
  }, [brandId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !brandId) return
    try {
      setInviting(true)
      setError("")
      const limitCheckRes = await fetch(`/api/brand/${brandId}/collaborators/check-limit`)
      const limitData = await limitCheckRes.json()
      if (!limitCheckRes.ok) {
        setError(limitData.error || "Failed to check collaborator limit")
        return
      }
      if (limitData.canBuyMore) {
        setBuySeatsModal({
          isOpen: true,
          maxSeatsAvailable: limitData.maxSeatsAvailable,
          pricePerSeat: limitData.pricePerSeat,
          currentExtraSeats: limitData.currentExtraSeats,
          maxTotalSeats: limitData.maxTotalSeats,
        })
        setInviting(false)
        return
      }
      if (!limitData.allowed) {
        setError("You've reached your collaborator limit. Upgrade your plan to add more collaborators.")
        setInviting(false)
        return
      }
      const res = await fetch(`/api/brand/${brandId}/collaborators/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to invite collaborator")
        return
      }
      const refetch = await fetch(`/api/brand/${brandId}/collaborators`)
      const refreshed = await refetch.json()
      setMembers(refreshed.members || [])
      setInviteEmail("")
      setInviteRole("manager")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!brandId || !confirm("Remove this collaborator?")) return
    try {
      setRemoving(userId)
      setError("")
      const res = await fetch(`/api/brand/${brandId}/collaborators/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to remove collaborator")
        return
      }
      setMembers(members.filter((m) => m.id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setRemoving(null)
    }
  }

  if (!dataLoaded) {
    return <LoadingScreen />
  }

  if (!brandId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-fit max-w-md">
          <CardContent className="flex flex-col items-center gap-1.5 px-6 py-5 text-center">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                width={16}
                height={16}
                className="text-emerald-600"
              >
                <circle cx="6" cy="5" r="2.5" />
                <path d="M1 14c0-2.8 2.2-5 5-5" />
                <circle cx="11" cy="5" r="2.5" />
                <path d="M15 14c0-2.8-2.2-5-5-5" />
              </svg>
              <p className="text-sm font-semibold text-foreground">No Brand Selected</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Please select a brand to manage collaborators.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-[1040px] px-9 py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Team & Collaborators</h1>
        <p className="text-xs text-muted-foreground">Manage who has access to your brand</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-[420px_1fr] items-start gap-5">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Owner */}
          {owner && (
            <Card>
              <div className="border-b px-5 py-3">
                <p className="text-sm font-semibold text-foreground">Brand owner</p>
              </div>
              <CardContent className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={owner.image || ""} alt={owner.name || ""} />
                    <AvatarFallback className="bg-emerald-600 font-semibold text-white">
                      {(owner.name || owner.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{owner.name || owner.email}</p>
                    <p className="text-xs text-muted-foreground">{owner.email}</p>
                  </div>
                </div>
                <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">
                  Admin
                </span>
              </CardContent>
            </Card>
          )}

          {/* Invite form */}
          <Card>
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <Mail className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Invite team member</p>
                <p className="text-xs leading-tight text-muted-foreground">Send an invite by email</p>
              </div>
            </div>
            <form onSubmit={handleInvite}>
              <CardContent className="space-y-3.5 pt-4">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Email address
                  </Label>
                  <Input
                    type="email"
                    placeholder="collaborator@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end border-t pt-3">
                  <Button
                    type="submit"
                    disabled={inviting || !inviteEmail.trim()}
                    className="gap-1.5 bg-[#15803d] text-white hover:bg-[#166534]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {inviting ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>

        {/* Right column — members list */}
        <Card className="h-full">
          <div className="border-b px-5 py-3">
            <p className="text-sm font-semibold text-foreground">Team members ({members.length})</p>
          </div>

          <CardContent className="pt-4">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mb-1 text-xs font-semibold text-foreground">No team members yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Invite collaborators on the left to get started
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="group flex items-center justify-between rounded-[9px] border px-3.5 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={member.image || ""} alt={member.name || ""} />
                        <AvatarFallback className="bg-emerald-50 font-semibold text-emerald-800">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {member.name || member.email}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold capitalize text-emerald-800">
                        {member.role}
                      </span>
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removing === member.id}
                        className="rounded-md p-1.5 text-red-500 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Buy Extra Seats Modal */}
      {buySeatsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-[420px]">
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight text-foreground">Upgrade your seats</p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Purchase additional seats to invite more team members
                </p>
              </div>
            </div>

            <CardContent className="space-y-5 pt-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[9px] border px-3.5 py-3">
                  <p className="mb-1 text-[10px] text-muted-foreground">Seats purchased</p>
                  <p className="text-xl font-bold text-foreground">{buySeatsModal.currentExtraSeats}</p>
                </div>
                <div className="rounded-[9px] border px-3.5 py-3">
                  <p className="mb-1 text-[10px] text-muted-foreground">Max available</p>
                  <p className="text-xl font-bold text-foreground">{buySeatsModal.maxTotalSeats}</p>
                </div>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Number of seats
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => setSeatsToAdd(Math.max(1, seatsToAdd - 1))}
                    disabled={seatsToAdd <= 1 || buyingSeats}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background disabled:opacity-50"
                  >
                    −
                  </button>
                  <Input
                    type="number"
                    min="1"
                    max={buySeatsModal.maxSeatsAvailable}
                    value={seatsToAdd}
                    onChange={(e) =>
                      setSeatsToAdd(
                        Math.min(buySeatsModal.maxSeatsAvailable, Math.max(1, parseInt(e.target.value) || 1))
                      )
                    }
                    disabled={buyingSeats}
                    className="w-16 text-center"
                  />
                  <button
                    onClick={() => setSeatsToAdd(Math.min(buySeatsModal.maxSeatsAvailable, seatsToAdd + 1))}
                    disabled={seatsToAdd + 1 > buySeatsModal.maxSeatsAvailable || buyingSeats}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border bg-background disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Up to {buySeatsModal.maxSeatsAvailable} more seat(s) available
                </p>
              </div>

              <div className="flex flex-col gap-2 border-t pt-3.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Price per seat</span>
                  <span className="font-semibold text-foreground">${buySeatsModal.pricePerSeat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Quantity</span>
                  <span className="font-semibold text-foreground">
                    {seatsToAdd} {seatsToAdd === 1 ? "seat" : "seats"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2.5">
                  <span className="text-sm font-semibold text-foreground">Total</span>
                  <span className="text-lg font-bold text-emerald-600">
                    ${(buySeatsModal.pricePerSeat * seatsToAdd).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <Script
                  src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&intent=capture`}
                  strategy="afterInteractive"
                  onLoad={() => setPaypalLoaded(true)}
                />
                <div ref={paypalRef} />
                <Button
                  variant="outline"
                  disabled={buyingSeats}
                  onClick={() => {
                    setBuySeatsModal((s) => ({ ...s, isOpen: false }))
                    if (paypalRef.current) paypalRef.current.innerHTML = ""
                  }}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function CollaboratorsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <CollaboratorsContent />
    </Suspense>
  )
}