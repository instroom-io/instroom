"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { PenLine } from "lucide-react"
import { toast } from "sonner"
import { SettingsSkeleton } from "@/components/shared/skeletons"

type SocialKey = "facebook" | "instagram" | "tiktok" | "twitter" | "linkedin"

// Kept in sync with lib/signature.ts's SOCIAL_ICON_SLUGS/SIMPLE_ICONS_VERSION —
// this preview must show the exact icons the sent email will use.
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

  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/signature")
      .then((r) => r.json())
      .then((data) => {
        setIsEnabled(data.is_enabled ?? true)
        setFullName(data.full_name ?? "")
        setTitle(data.title ?? "")
        setCompany(data.company ?? "")
        setPhone(data.phone ?? "")
        setEmail(data.email ?? "")
        setWebsite(data.website ?? "")
        setSocialLinks(data.social_links ?? {})
      })
      .catch(() => toast.error("Failed to load signature"))
      .finally(() => setLoaded(true))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true)
    try {
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
        }),
      })
      if (!res.ok) throw new Error("Failed to save signature")
      toast.success("Signature saved")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
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

          <div className="mt-5 border-t pt-4">
            <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Preview</Label>
            <div className="rounded-lg border border-border bg-muted/30 p-4 font-sans">
              {(fullName || title || company || phone || email || website) && (
                <p className="text-sm text-foreground">-- </p>
              )}
              {(fullName || title) && (
                <p className="text-sm">
                  {fullName && <span className="font-bold" style={{ color: "#1F2937" }}>{fullName}</span>}
                  {title && (
                    <span className="text-foreground">{fullName ? " | " : ""}{title}</span>
                  )}
                </p>
              )}
              {company && <p className="text-sm text-foreground">{company}</p>}
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {phone && <p>mobile: <span className="underline" style={{ color: "#1155CC" }}>{phone}</span></p>}
                {email && <p>email: <span className="underline" style={{ color: "#1155CC" }}>{email}</span></p>}
                {website && <p>website: <span className="underline" style={{ color: "#1155CC" }}>{website}</span></p>}
              </div>
              {previewLines.socials.length > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  {previewLines.socials.map((f) => (
                    <img key={f.key} src={socialIconUrl(f.slug)} alt={f.label} width={16} height={16} />
                  ))}
                </div>
              )}
              {!fullName && !title && !company && !phone && !email && !website && (
                <p className="text-xs text-muted-foreground">
                  Fill in the fields above to see a preview of your signature.
                </p>
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
