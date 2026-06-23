"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, Palette, Lock, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"

function BrandingContent() {
  const searchParams = useSearchParams()
  const [brandId, setBrandId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const { data: session } = useSession()

  const [brandingAllowed, setBrandingAllowed] = useState<boolean | null>(null)
  const [brandName, setBrandName] = useState("")
  const [brandWebsite, setBrandWebsite] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [currentLogo, setCurrentLogo] = useState<string | null>(null)
  const [savingBranding, setSavingBranding] = useState(false)
  const [brandingSaved, setBrandingSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const id = searchParams.get("brandId")
    setBrandId(id)
  }, [searchParams])

  useEffect(() => {
    if (!session?.user?.id) return
    fetch("/api/subscription/branding-access")
      .then((r) => r.json())
      .then((d) => setBrandingAllowed(d.allowed ?? false))
      .catch(() => setBrandingAllowed(false))
  }, [session?.user?.id])

  useEffect(() => {
    if (!brandId) return
    fetch(`/api/brand/${brandId}/collaborators`)
      .then((r) => r.json())
      .then((data) => {
        if (data.brand) {
          setBrandName(data.brand.name || "")
          setBrandWebsite(data.brand.website_url || "")
          setCurrentLogo(data.brand.logo_url || null)
        }
      })
      .catch((err) => console.error("Error fetching brand:", err))
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
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
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

  if (!mounted) {
    return null
  }

  if (!brandId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No Brand Selected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please select a brand to customize branding.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: "28px 36px", maxWidth: 780 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#1E1E1E", marginBottom: 4 }}>
        Branding
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
        Customize your workspace appearance
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {brandingAllowed === null ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 rounded-full border-2 border-[#1FAE5B] border-t-transparent animate-spin" />
        </div>
      ) : !brandingAllowed ? (
        <div
          style={{
            border: "0.5px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
          }}
          className="flex items-start gap-4 p-5 bg-white"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-[9px] bg-[#f0faf5] shrink-0">
            <Lock className="h-4 w-4 text-[#1FAE5B]" />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }} className="mb-1">
              Upgrade to Customize Branding
            </div>
            <p style={{ fontSize: 11, color: "#888" }} className="mb-4">
              Custom branding is available on{" "}
              <span style={{ color: "#1E1E1E", fontWeight: 600 }}>Solo and Team plans</span>.
              Upgrade your subscription to customize your brand.
            </p>
            <Link href="/pricing?cycle=monthly">
              <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1FAE5B] hover:bg-[#0F6B3E] text-white text-sm font-medium transition-colors">
                View Plans <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Card header row — icon + title + description */}
          <div
            style={{ borderBottom: "0.5px solid rgba(0,0,0,0.07)" }}
            className="flex items-start gap-3 px-5 py-4"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-[9px] bg-[#f0faf5] shrink-0">
              <Palette className="h-4 w-4 text-[#1FAE5B]" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>Brand identity</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                Logo and name shown across your workspace
              </div>
            </div>
          </div>

          {/* Body — logo + fields side by side */}
          <div className="px-5 py-5">
            <div className="flex gap-6 max-w-2xl">
              {/* Left column — logo */}
              <div className="w-[120px] flex-shrink-0">
                <label style={{ fontSize: 11, fontWeight: 600, color: "#555" }} className="mb-2 block">
                  Brand logo
                </label>
                <label
                  htmlFor="logo-input"
                  className="flex flex-col items-center justify-center w-full aspect-square rounded-lg border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors overflow-hidden text-center p-2"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                  ) : currentLogo ? (
                    <img src={currentLogo} alt="Current logo" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Palette className="h-6 w-6 text-gray-400 mb-1" />
                      <span className="text-[11px] text-gray-400 leading-tight">
                        Upload logo
                        <br />
                        PNG, JPG, SVG
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
                    style={{ fontSize: 10, color: "#aaa", marginTop: 6 }}
                    className="hover:text-red-500 transition disabled:opacity-50"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              {/* Right column — name + website */}
              <div className="flex-1 space-y-4">
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#555" }} className="mb-1 block">
                    Brand name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter your brand name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    style={{
                      fontSize: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "0.5px solid rgba(0,0,0,0.15)",
                    }}
                    className="w-full focus:outline-none focus:border-[#1FAE5B] focus:ring-2 focus:ring-[#1FAE5B]/20"
                  />
                  <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                    Shown in the top navigation and emails
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#555" }} className="mb-1 block">
                    Brand website{" "}
                    <span style={{ color: "#aaa", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={brandWebsite}
                    onChange={(e) => setBrandWebsite(e.target.value)}
                    style={{
                      fontSize: 12,
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "0.5px solid rgba(0,0,0,0.15)",
                    }}
                    className="w-full focus:outline-none focus:border-[#1FAE5B] focus:ring-2 focus:ring-[#1FAE5B]/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer — save button right-aligned */}
          <div
            style={{ borderTop: "0.5px solid rgba(0,0,0,0.06)" }}
            className="flex justify-end px-5 py-4"
          >
            <button
              onClick={handleSaveBranding}
              disabled={savingBranding}
              style={{
                fontSize: 12,
                fontWeight: 500,
                padding: "8px 18px",
                borderRadius: 9,
                background: "#1FAE5B",
                color: "#fff",
              }}
              className="disabled:opacity-60"
            >
              {savingBranding ? "Saving..." : brandingSaved ? "Saved!" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BrandingPage() {
  return (
    <Suspense>
      <BrandingContent />
    </Suspense>
  )
}