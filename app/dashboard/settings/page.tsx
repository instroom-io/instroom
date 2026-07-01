"use client"
// app/dashboard/settings/page.tsx

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { User, CreditCard, Loader2 } from "lucide-react"
import { toast } from "sonner" // swap for your shadcn toast hook if you use a different one

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-stone-400">Loading</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession()
  const router = useRouter()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [timezone, setTimezone] = useState("Asia/Manila (UTC+8)")
  const [currency, setCurrency] = useState("USD ($)")
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY")

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Gate the form behind a single loading flag. Stays true until BOTH
  // /api/settings/profile and /api/settings/preferences have resolved
  // (success or failure), so the form never renders with placeholder
  // defaults before real data arrives.
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const dataLoaded = profileLoaded && prefsLoaded

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "??"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) {
          const parts = data.name.split(" ")
          setFirstName(parts[0] ?? "")
          setLastName(parts.slice(1).join(" ") ?? "")
        }
        if (data.email) setEmail(data.email)
        if (data.jobTitle) setJobTitle(data.jobTitle)
        if (data.image) setAvatarUrl(data.image)
      })
      .catch(() => {
        if (session?.user?.name) {
          const parts = session.user.name.split(" ")
          setFirstName(parts[0] ?? "")
          setLastName(parts.slice(1).join(" ") ?? "")
        }
        if (session?.user?.email) setEmail(session.user.email)
        if (session?.user?.image) setAvatarUrl(session.user.image)
      })
      .finally(() => setProfileLoaded(true))

    fetch("/api/settings/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.timezone) setTimezone(data.timezone)
        if (data.currency) setCurrency(data.currency)
        if (data.dateFormat) setDateFormat(data.dateFormat)
      })
      .catch(() => {})
      .finally(() => setPrefsLoaded(true))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.")
      return
    }

    setAvatarUrl(URL.createObjectURL(file))
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/settings/profile", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")

      const data = await res.json()
      setAvatarUrl(data.avatarUrl)
      updateSession({ image: data.avatarUrl })
      toast.success("Photo updated")
    } catch {
      toast.error("Upload failed. Please try again.")
      setAvatarUrl(session?.user?.image ?? null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, jobTitle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save profile")
      toast.success("Profile saved successfully")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePrefs() {
    setSavingPrefs(true)
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, currency, dateFormat }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save preferences")
      toast.success("Preferences saved")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSavingPrefs(false)
    }
  }

  async function handleDeleteAccount() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeletingAccount(true)
    try {
      const res = await fetch("/api/settings/account", { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete account")
      router.push("/login")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setDeletingAccount(false)
      setConfirmDelete(false)
    }
  }

  // Spinner stays up until session resolves AND both fetches complete.
  if (status === "loading" || !dataLoaded) {
    return <LoadingScreen />
  }

  return (
    <div className="max-w-3xl px-9 py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Profile</h1>
        <p className="text-xs text-muted-foreground">Manage your personal account information</p>
      </div>

      {/* Personal Information */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">Personal Information</p>
            <p className="text-xs leading-tight text-muted-foreground">Your name and email visible across the workspace</p>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl ?? undefined} alt="Avatar" />
              <AvatarFallback className="bg-primary text-lg font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Change photo"}
              </Button>
              <p className="mt-1 text-[10px] text-muted-foreground">PNG, JPG or WebP · max 5MB</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <Label htmlFor="firstName" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                First name
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lastName" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Last name
              </Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="email" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label htmlFor="jobTitle" className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Job title <span className="font-normal text-muted-foreground/70">(optional)</span>
              </Label>
              <Input
                id="jobTitle"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Marketing Manager"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              className="bg-[#15803d] hover:bg-[#166534] text-white"
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/10">
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">Preferences</p>
            <p className="text-xs leading-tight text-muted-foreground">Language, timezone and display settings</p>
          </div>
        </div>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Asia/Manila (UTC+8)">Asia/Manila (UTC+8)</SelectItem>
                  <SelectItem value="Asia/Singapore (UTC+8)">Asia/Singapore (UTC+8)</SelectItem>
                  <SelectItem value="America/New_York (UTC-5)">America/New_York (UTC-5)</SelectItem>
                  <SelectItem value="Europe/London (UTC+0)">Europe/London (UTC+0)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Currency display</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD ($)">USD ($)</SelectItem>
                  <SelectItem value="PHP (₱)">PHP (₱)</SelectItem>
                  <SelectItem value="SGD (S$)">SGD (S$)</SelectItem>
                  <SelectItem value="EUR (€)">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date format</Label>
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              className="bg-[#15803d] hover:bg-[#166534] text-white"
              onClick={handleSavePrefs}
              disabled={savingPrefs}
            >
              {savingPrefs ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/25 bg-destructive/5 p-4">
        <p className="mb-1 text-xs font-semibold text-destructive">Danger zone</p>
        <p className="mb-3 text-[11px] text-muted-foreground">
          {confirmDelete
            ? "Are you sure? This permanently deletes your account and all data. Click again to confirm."
            : "Permanently delete your account and all associated data. This action cannot be undone."}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant={confirmDelete ? "destructive" : "outline"}
            size="sm"
            className={confirmDelete ? "" : "border-destructive text-destructive hover:bg-destructive/10"}
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? "Deleting…" : confirmDelete ? "Confirm delete" : "Delete account"}
          </Button>
          {confirmDelete && (
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}