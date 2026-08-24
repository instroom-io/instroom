"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, Palette, Lock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { fetchCached, getCachedData, hasCachedData } from "@/lib/data-cache"

// Must match the server-side check in api/brand/branding/route.ts.
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024

function LoadingScreen() {
  return <SettingsSkeleton sections={[{ fields: 2 }]} label="Loading branding…" />
}

function BrandingContent() {
  const searchParams = useSearchParams()
  const { data: session } = useSession()

  const [brandId, setBrandId] = useState<string | null>(null)
  const [paramsResolved, setParamsResolved] = useState(false)

  const [brandingAllowed, setBrandingAllowed] = useState<boolean | null>(null)
  const [brandName, setBrandName] = useState("")
  const [brandWebsite, setBrandWebsite] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const [error, setError] = useState("")

  // Gate the form behind these two flags. Both must resolve (success or
  // failure) before anything renders, so the brand-identity form never
  // flashes with empty fields before the real name/logo/website arrive.
  // Both are pre-resolved when the shared cache already holds the answers, so
  // returning to this page shows the form instead of the gate.
  const cachedAccess = getCachedData<{ allowed?: boolean }>("/api/subscription/branding-access")

  const [accessChecked, setAccessChecked] = useState(cachedAccess !== undefined)
  const [brandDataLoaded, setBrandDataLoaded] = useState(false)

  useEffect(() => {
    const id = searchParams.get("brandId")
    setBrandId(id)
    setParamsResolved(true)
  }, [searchParams])

  useEffect(() => {
    if (!session?.user?.id) return
    fetchCached<any>("/api/subscription/branding-access", async () => {
      const r = await fetch("/api/subscription/branding-access")
      if (!r.ok) throw new Error(`Request failed (${r.status})`)
      return r.json()
    })
      .then((d) => setBrandingAllowed(d.allowed ?? false))
      .catch(() => setBrandingAllowed(false))
      .finally(() => setAccessChecked(true))
  }, [session?.user?.id])

  useEffect(() => {
    if (!brandId) {
      setBrandDataLoaded(true)
      return
    }
    // Keep the current form on screen while a cached brand revalidates.
    setBrandDataLoaded(hasCachedData(`/api/brand/${brandId}/collaborators`))
    fetchCached<any>(`/api/brand/${brandId}/collaborators`, async () => {
      const r = await fetch(`/api/brand/${brandId}/collaborators`)
      if (!r.ok) throw new Error(`Request failed (${r.status})`)
      return r.json()
    })
      .then((data) => {
        if (data.brand) {
          setBrandName(data.brand.name || "")
          setBrandWebsite(data.brand.website_url || "")
          setCurrentLogo(data.brand.logo_url || null)
        }
      })
      .catch((err) => console.error("Error fetching brand:", err))
      .finally(() => setBrandDataLoaded(true))
  }, [brandId])

  const handleSaveBranding = async () => {
    try {
      setSavingBranding(true)
      const formData = new FormData()
      formData.append("brandId", brandId!)
      formData.append("brandName", brandName)
      formData.append("brandWebsite", brandWebsite)
      if (logoFile) {
        formData.append("logo", logoFile)
      }

      const response = await fetch("/api/brand/branding", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const err = await response.json()
        setError(err.error || "Failed to save branding")
        return
      }

      const data = await response.json()
      setCurrentLogo(data.logoUrl || null)
      setBrandName(data.brand?.name || brandName)
      setBrandWebsite(data.brand?.website_url || brandWebsite)
      setLogoFile(null)
      setLogoPreview(null)
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save branding")
    } finally {
      setSavingBranding(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // The input's accept= attribute only filters the OS picker's default
    // view — drag-and-drop and "All Files" bypass it entirely, so a rejected
    // file still needs to be caught here, not just relied on server-side.
    // Same allowed list and size cap as api/brand/branding/route.ts.
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError("That file type isn't supported. Please upload a PNG, JPG, SVG, or WebP image.")
      e.target.value = ""
      return
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setError("That image is too large. Please upload a file under 5MB.")
      e.target.value = ""
      return
    }

    setError("")
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = async () => {
    try {
      setSavingBranding(true)
      const response = await fetch("/api/brand/branding", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId }),
      })

      if (!response.ok) {
        const err = await response.json()
        setError(err.error || "Failed to remove logo")
        return
      }

      setCurrentLogo(null)
      setLogoFile(null)
      setLogoPreview(null)
      setBrandingSaved(true)
      setTimeout(() => setBrandingSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo")
    } finally {
      setSavingBranding(false)
    }
  }

  // Wait for: search params resolved, access check done, and (if a brand
  // is selected) the brand data fetch done.
  if (!paramsResolved || !accessChecked || !brandDataLoaded) {
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
                <circle cx="8" cy="8" r="6" />
                <circle cx="8" cy="8" r="2" />
              </svg>
              <p className="text-sm font-semibold text-foreground">No Brand Selected</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Please select a brand to customize branding.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Branding</h1>
        <p className="text-xs text-muted-foreground">Customize your workspace appearance</p>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {!brandingAllowed ? (
        <Card className="mb-4">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
              <Lock className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="mb-1 text-sm font-semibold text-foreground">
                Upgrade to Customize Branding
              </p>
              <p className="mb-4 text-xs text-muted-foreground">
                Custom branding is available on{" "}
                <span className="font-semibold text-foreground">Solo and Team plans</span>.
                Upgrade your subscription to customize your brand.
              </p>
              <Link href="/pricing?cycle=monthly">
                <Button className="bg-[#15803d] hover:bg-[#166534] text-white">
                  View Plans <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="flex items-center gap-3 border-b px-5 py-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
              <Palette className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">Brand identity</p>
              <p className="text-xs leading-tight text-muted-foreground">
                Logo and name shown across your workspace
              </p>
            </div>
          </div>

          <CardContent className="pt-5">
            <div className="flex flex-col sm:flex-row max-w-2xl gap-6">
              {/* Logo */}
              <div className="w-[120px] flex-shrink-0">
                <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  Brand logo
                </Label>
                <label
                  htmlFor="logo-input"
                  className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/50 p-2 text-center transition-colors hover:bg-muted"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : currentLogo ? (
                    <img src={currentLogo} alt="Current logo" className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <Palette className="mb-1 h-6 w-6 text-muted-foreground" />
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        Upload logo
                        <br />
                        PNG, JPG, SVG, WebP
                        <br />
                        max 5MB
                      </span>
                    </>
                  )}
                </label>
                <input
                  id="logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handleLogoChange}
                  disabled={savingBranding}
                  className="hidden"
                />
                {(currentLogo || logoPreview) && (
                  <button
                    onClick={handleRemoveLogo}
                    disabled={savingBranding}
                    className="mt-1.5 text-[10px] text-muted-foreground transition hover:text-red-500 disabled:opacity-50"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              {/* Name + website */}
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Brand name
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter your brand name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Shown in the top navigation and emails
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Brand website{" "}
                    <span className="font-normal text-muted-foreground/70">(optional)</span>
                  </Label>
                  <Input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end border-t pt-3">
              <Button
                onClick={handleSaveBranding}
                disabled={savingBranding}
                className="bg-[#15803d] hover:bg-[#166534] text-white"
              >
                {savingBranding ? "Saving…" : brandingSaved ? "Saved!" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function BrandingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BrandingContent />
    </Suspense>
  )
}