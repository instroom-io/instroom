"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { KeyRound, ShieldCheck } from "lucide-react"
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

      <div className="mb-1 text-lg font-semibold text-gray-900">Security</div>
      <div className="mb-6 text-xs text-stone-400">
        Manage your password and login settings
      </div>

      {/* Change Password Card */}
      <div className="mb-4 overflow-hidden rounded-xl border border-black/[0.08] bg-white">
        <div className="flex items-start gap-3 border-b border-black/[0.07] px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-emerald-50">
            <KeyRound className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-gray-900">Change password</div>
            <div className="mt-0.5 text-[11px] text-stone-400">
              Update your password to keep your account secure
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3.5">
            <div className="col-span-2 flex flex-col gap-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Current password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                New password
              </Label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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

          <div className="mt-4 flex justify-end gap-2 border-t border-black/[0.06] pt-3.5">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </div>
      </div>

      {/* 2FA Card */}
      <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white">
        <div className="flex items-start gap-3 border-b border-black/[0.07] px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] bg-emerald-50">
            <ShieldCheck className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-gray-900">
              Two-factor authentication
            </div>
            <div className="mt-0.5 text-[11px] text-stone-400">
              Add an extra layer of security to your account
            </div>
          </div>
        </div>

        <div className="p-5">
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
        </div>
      </div>
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
        !last && "border-b border-black/5",
        loading && "opacity-60"
      )}
    >
      <div>
        <div className="text-xs font-medium text-gray-900">{title}</div>
        <div className="mt-0.5 text-[11px] text-stone-400">{desc}</div>
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