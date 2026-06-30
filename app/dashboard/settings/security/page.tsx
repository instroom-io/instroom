"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { KeyRound, ShieldCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { TwoFactorSetup } from "@/components/two-factor-setup"

type Toast = { message: string; type: "success" | "error" }

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const show = (message: string, type: Toast["type"]) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Loading</p>
    </div>
  )
}

export default function SecurityPage() {
  const { status } = useSession()
  const router = useRouter()
  const { toast, show } = useToast()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)

  const [totpEnabled, setTotpEnabled] = useState(false)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [togglingSms, setTogglingSms] = useState(false)

  const [securityLoaded, setSecurityLoaded] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status !== "authenticated") return

    fetch("/api/settings/security/2fa")
      .then((r) => r.json())
      .then((data) => {
        setTotpEnabled(data.totp ?? false)
        setSmsEnabled(data.sms ?? false)
      })
      .catch(() => {})
      .finally(() => setSecurityLoaded(true))
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      show("All password fields are required", "error")
      return
    }
    if (newPassword !== confirmPassword) {
      show("New passwords don't match.", "error")
      return
    }
    if (newPassword.length < 8) {
      show("Password must be at least 8 characters.", "error")
      return
    }
    setSavingPassword(true)
    try {
      const res = await fetch("/api/user/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update password")
      show("Password updated successfully", "success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      show(err.message || "Something went wrong", "error")
    } finally {
      setSavingPassword(false)
    }
  }

  async function toggleSms(current: boolean) {
    setTogglingSms(true)
    try {
      const res = await fetch("/api/settings/security/2fa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "sms", enabled: !current }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update 2FA")
      setSmsEnabled(!current)
      show(`SMS ${!current ? "enabled" : "disabled"}`, "success")
    } catch (err: any) {
      show(err.message || "Something went wrong", "error")
    } finally {
      setTogglingSms(false)
    }
  }

  if (status === "loading" || !securityLoaded) {
    return <LoadingScreen />
  }

  return (
    <div className="max-w-3xl px-9 py-7">
      {toast && (
        <div
          className={cn(
            "fixed top-5 right-6 z-[9999] rounded-[10px] px-4.5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
            toast.type === "success" ? "bg-emerald-600" : "bg-red-500"
          )}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Security</h1>
        <p className="text-xs text-muted-foreground">Manage your password and login settings</p>
      </div>

      {/* Change Password */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
            <KeyRound className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">Change password</p>
            <p className="text-xs leading-tight text-muted-foreground">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <CardContent className="pt-4">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2 space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Current password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                New password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Confirm new password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t pt-3">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="bg-[#15803d] hover:bg-[#166534] text-white"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card className="mb-4">
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
            <ShieldCheck className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">
              Two-factor authentication
            </p>
            <p className="text-xs leading-tight text-muted-foreground">
              Add an extra layer of security to your account
            </p>
          </div>
        </div>

        <CardContent className="pt-4">
          <TwoFactorSetup
            enabled={totpEnabled}
            onEnabledChange={setTotpEnabled}
            onToast={show}
          />

          <ToggleRow
            title="SMS verification"
            desc="Receive a code via text message when logging in"
            enabled={smsEnabled}
            loading={togglingSms}
            onToggle={() => toggleSms(smsEnabled)}
            last
          />
        </CardContent>
      </Card>
    </div>
  )
}

function ToggleRow({
  title,
  desc,
  enabled,
  loading,
  onToggle,
  last,
}: {
  title: string
  desc: string
  enabled: boolean
  loading: boolean
  onToggle: () => void
  last?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-3 transition-opacity",
        !last && "border-b",
        loading && "opacity-60"
      )}
    >
      <div>
        <p className="text-xs font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <Switch
        checked={enabled}
        disabled={loading}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-emerald-600"
      />
    </div>
  )
}