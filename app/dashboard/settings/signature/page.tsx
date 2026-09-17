"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { PenLine, ImagePlus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { fetchCached, invalidateCache } from "@/lib/data-cache"

const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_ACCENT = "#1F2937"

type SocialKey = "facebook" | "instagram" | "tiktok" | "twitter" | "linkedin"

const SIMPLE_ICONS_VERSION = "13.20.0"
const SOCIAL_FIELDS: { key: SocialKey; label: string; slug: string; placeholder: string }[] = [
  { key: "facebook", label: "Facebook", slug: "facebook", placeholder: "https://facebook.com/yourpage" },
  { key: "instagram", label: "Instagram", slug: "instagram", placeholder: "https://instagram.com/yourhandle" },
  { key: "tiktok", label: "TikTok", slug: "tiktok", placeholder: "https://tiktok.com/@yourhandle" },
  { key: "twitter", label: "X", slug: "x", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", slug: "linkedin", placeholder: "https://linkedin.com/in/yourname" },
]
const socialIconUrl = (slug: string) =>
  `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/${slug}.svg`

function GmailSignaturePreviewFrame({ html }: { html: string }) {
  const [height, setHeight] = useState(60)
  return (
    <iframe
      key={html}
      title="Gmail signature preview"
      sandbox="allow-same-origin"
      style={{ width: "100%", height, border: 0, display: "block" }}
      srcDoc={`<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif;">${html}</body></html>`}
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument
        if (doc) setHeight(Math.max(40, doc.documentElement.scrollHeight + 4))
      }}
    />
  )
}

export default function SignaturePage() {
  const { status } = useSession()
  const router = useRouter()

  const [isEnabled, setIsEnabled] = useState(true)
  const [fullName, setFullName] = useState("")
  const [title, setTitle] = useState("")
  const [company, setCompany] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [socialLinks, setSocialLinks] = useState<Partial<Record<SocialKey, string>>>({})
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState("")

  // Replaces the fields below rather than filling them in — Gmail's raw HTML
  // has no separable name/title/photo to map onto the form.
  const [gmailConnected, setGmailConnected] = useState(false)
  const [useGmailSignature, setUseGmailSignature] = useState(false)
  const [gmailSignatureHtml, setGmailSignatureHtml] = useState<string | null>(null)
  const [fetchingGmailSignature, setFetchingGmailSignature] = useState(false)
  const [gmailSignatureError, setGmailSignatureError] = useState<{ message: string; reauth?: boolean } | null>(null)

  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetchCached<any>("/api/settings/signature", async () => {
      const r = await fetch("/api/settings/signature")
      if (!r.ok) throw new Error(`signature failed (${r.status})`)
      return await r.json()
    })
      .then((data) => {
        setIsEnabled(data.is_enabled ?? true)
        setFullName(data.full_name ?? "")
        setTitle(data.title ?? "")
        setCompany(data.company ?? "")
        setPhone(data.phone ?? "")
        setEmail(data.email ?? "")
        setWebsite(data.website ?? "")
        setSocialLinks(data.social_links ?? {})
        setAccentColor(data.accent_color ?? DEFAULT_ACCENT)
        setCurrentPhoto(data.photo_url ?? null)
        setUseGmailSignature(data.use_gmail_signature ?? false)
        setGmailSignatureHtml(data.gmail_signature_html ?? null)
      })
      .catch(() => toast.error("Failed to load signature"))
      .finally(() => setLoaded(true))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "authenticated") return
    fetchCached<any>("/api/mail/accounts", async () => {
      const r = await fetch("/api/mail/accounts")
      if (!r.ok) throw new Error(`mail accounts failed (${r.status})`)
      return await r.json()
    })
      .then((data) => setGmailConnected((data.accounts ?? []).some((a: any) => a.provider === "gmail")))
      .catch(() => setGmailConnected(false))
  }, [status])

  async function fetchGmailSignature(): Promise<string | null> {
    setFetchingGmailSignature(true)
    setGmailSignatureError(null)
    try {
      const res = await fetch("/api/gmail/signature")
      const data = await res.json()
      if (!res.ok) {
        setGmailSignatureError({ message: data?.error || "Failed to read your Gmail signature.", reauth: data?.reauth })
        return null
      }
      setGmailSignatureHtml(data.signature)
      return data.signature as string
    } catch {
      setGmailSignatureError({ message: "Failed to read your Gmail signature." })
      return null
    } finally {
      setFetchingGmailSignature(false)
    }
  }

  async function handleToggleGmailSignature(checked: boolean) {
    if (!checked) {
      setUseGmailSignature(false)
      try {
        await persistSignature({ use_gmail_signature: false })
      } catch {
        toast.error("Failed to save")
      }
      return
    }
    const signature = await fetchGmailSignature()
    if (!signature) return // stays unchecked — see fetchGmailSignature's error state
    setUseGmailSignature(true)
    try {
      await persistSignature({ use_gmail_signature: true, gmail_signature_html: signature })
    } catch {
      setUseGmailSignature(false)
      toast.error("Failed to save")
    }
  }

  // Shared by the Save button and the Gmail checkbox (which saves itself
  // immediately). Overrides let a caller send a value before its own setState
  // has committed, e.g. the checkbox persisting use_gmail_signature right away.
  async function persistSignature(overrides: Record<string, unknown> = {}) {
    const res = await fetch("/api/settings/signature", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        is_enabled: isEnabled,
        full_name: fullName,
        title,
        company,
        phone,
        email,
        website,
        social_links: socialLinks,
        accent_color: accentColor,
        use_gmail_signature: useGmailSignature,
        gmail_signature_html: gmailSignatureHtml,
        ...overrides,
      }),
    })
    if (!res.ok) throw new Error("Failed to save signature")
    invalidateCache("/api/settings/signature")
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (photoFile) {
        const form = new FormData()
        form.append("photo", photoFile)
        const photoRes = await fetch("/api/settings/signature", { method: "POST", body: form })
        if (!photoRes.ok) throw new Error("Failed to upload photo")
        const { photo_url } = await photoRes.json()
        setCurrentPhoto(photo_url)
        setPhotoFile(null)
        setPhotoPreview(null)
      }

      await persistSignature()
      toast.success("Signature saved")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // accept= only filters the OS picker, not drag-and-drop — same as branding's logo upload.
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("That file type isn't supported. Please upload a PNG, JPG, SVG, or WebP image.")
      e.target.value = ""
      return
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError("That image is too large. Please upload a file under 5MB.")
      e.target.value = ""
      return
    }

    setPhotoError("")
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleRemovePhoto() {
    if (!currentPhoto && !photoPreview) return
    setPhotoFile(null)
    setPhotoPreview(null)
    if (!currentPhoto) return
    try {
      const res = await fetch("/api/settings/signature", { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to remove photo")
      setCurrentPhoto(null)
      invalidateCache("/api/settings/signature")
    } catch {
      toast.error("Failed to remove photo")
    }
  }

  const previewLines = useMemo(() => {
    const socials = SOCIAL_FIELDS.filter((f) => socialLinks[f.key])
    return { socials }
  }, [socialLinks])

  if (status === "loading" || !loaded) {
    return <SettingsSkeleton sections={[{ fields: 4 }]} label="Loading signature…" />
  }

  return (
    <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Email Signature</h1>
        <p className="text-xs text-muted-foreground">
          Appended to emails you send from the Instroom inbox
        </p>
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
              <PenLine className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-foreground">Signature details</p>
              <p className="text-xs leading-tight text-muted-foreground">
                Shown at the bottom of new messages and replies
              </p>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>

        <CardContent className="pt-4">
          <div className="mb-4 rounded-lg border border-border bg-muted/30 p-3">
            <label className={cn("flex items-start gap-2.5", gmailConnected ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
              <input
                type="checkbox"
                checked={useGmailSignature}
                disabled={!gmailConnected || fetchingGmailSignature}
                onChange={(e) => handleToggleGmailSignature(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-[#15803d]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Get your signature from Gmail
                  {fetchingGmailSignature && <span className="ml-2 text-xs font-normal text-muted-foreground">Fetching…</span>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {gmailConnected
                    ? "Uses the signature already set in Gmail's own settings instead of the fields below."
                    : "Connect a Gmail account in the Inbox to use this."}
                </span>
              </span>
            </label>
            {useGmailSignature && (
              <button
                type="button"
                onClick={fetchGmailSignature}
                disabled={fetchingGmailSignature}
                className="ml-[26px] mt-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
              >
                Refresh from Gmail
              </button>
            )}
            {gmailSignatureError && (
              <p className="ml-[26px] mt-1.5 text-xs text-destructive">
                {gmailSignatureError.message}
                {gmailSignatureError.reauth && (
                  <>
                    {" "}
                    <a href="/api/gmail/connect?returnTo=/dashboard/settings/signature" className="underline">
                      Reconnect Gmail
                    </a>
                  </>
                )}
              </p>
            )}
          </div>

          <fieldset disabled={useGmailSignature} className={cn(useGmailSignature && "opacity-50")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Armand Manibo" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Founder" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Armful Media" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+63 9-08267-9775" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@armfulmedia.com" />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Website</Label>
              <Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://www.armfulmedia.com" />
            </div>
          </div>

          <div className="mt-5 border-t pt-4">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* object-contain, not cover: a logo isn't guaranteed square. */}
              <div className="flex w-[104px] flex-shrink-0 flex-col">
                <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
                  Photo / logo
                </Label>
                {(() => {
                  const shownPhoto = photoPreview || currentPhoto
                  return (
                    <label
                      htmlFor="signature-photo-input"
                      title={shownPhoto ? "Click to replace" : "Click to upload"}
                      className={cn(
                        "group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg p-2 text-center transition-colors",
                        shownPhoto
                          ? "border border-border bg-background hover:bg-muted/40"
                          : "border border-dashed border-border bg-muted/50 hover:bg-muted"
                      )}
                    >
                      {shownPhoto ? (
                        <>
                          <img src={shownPhoto} alt="Signature photo" className="h-full w-full object-contain" />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/60 text-[10px] font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                            Replace
                          </span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="mb-1 h-5 w-5 text-muted-foreground" />
                          <span className="text-[10px] leading-tight text-muted-foreground">
                            PNG, JPG, SVG, WebP
                            <br />
                            max 5MB
                          </span>
                        </>
                      )}
                    </label>
                  )
                })()}
                <input
                  id="signature-photo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                {(currentPhoto || photoPreview) && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-1.5 w-full text-center text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
                {photoError && <p className="mt-1 text-[11px] text-destructive">{photoError}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Accent color</Label>
                <p className="mb-1 text-[11px] text-muted-foreground">Used for your name and links</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded-md border border-border bg-background p-1"
                  />
                  <Input
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    placeholder={DEFAULT_ACCENT}
                    className="w-28 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t pt-4">
            <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
              Social links <span className="font-normal text-muted-foreground/70">(optional)</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {SOCIAL_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Input
                    type="url"
                    value={socialLinks[f.key] ?? ""}
                    onChange={(e) =>
                      setSocialLinks((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
          </fieldset>

          <div className="mt-5 border-t pt-4">
            <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Preview</Label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 font-sans">
              {useGmailSignature ? (
                gmailSignatureHtml ? (
                  <GmailSignaturePreviewFrame html={gmailSignatureHtml} />
                ) : (
                  <p className="text-xs text-muted-foreground">Fetching your Gmail signature…</p>
                )
              ) : !fullName && !title && !company && !phone && !email && !website ? (
                <p className="text-xs text-muted-foreground">
                  Fill in the fields above to see a preview of your signature.
                </p>
              ) : (
                <div className="flex items-start gap-3">
                  {(photoPreview || currentPhoto) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview || currentPhoto || undefined}
                      alt=""
                      className="max-h-[72px] max-w-[72px] object-contain"
                    />
                  )}
                  <div>
                    <p className="text-sm text-foreground">-- </p>
                    {(fullName || title) && (
                      <p className="text-sm">
                        {fullName && <span className="font-bold" style={{ color: accentColor }}>{fullName}</span>}
                        {title && (
                          <span className="text-foreground">{fullName ? " | " : ""}{title}</span>
                        )}
                      </p>
                    )}
                    {company && <p className="text-sm text-foreground">{company}</p>}
                    <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                      {phone && <p>mobile: <span className="underline" style={{ color: accentColor }}>{phone}</span></p>}
                      {email && <p>email: <span className="underline" style={{ color: accentColor }}>{email}</span></p>}
                      {website && <p>website: <span className="underline" style={{ color: accentColor }}>{website}</span></p>}
                    </div>
                    {previewLines.socials.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-2">
                        {previewLines.socials.map((f) => (
                          <img key={f.key} src={socialIconUrl(f.slug)} alt={f.label} width={16} height={16} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              className="bg-[#15803d] hover:bg-[#166534] text-white"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
