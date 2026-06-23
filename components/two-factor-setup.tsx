"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Step = "qr" | "confirm" | "backup-codes" | "disable" | null

interface TwoFactorSetupProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  onToast: (message: string, type: "success" | "error") => void
}

export function TwoFactorSetup({ enabled, onEnabledChange, onToast }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>(null)
  const [loading, setLoading] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [code, setCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [disablePassword, setDisablePassword] = useState("")
  const [error, setError] = useState("")

  function resetAndClose() {
    setStep(null)
    setCode("")
    setError("")
    setDisablePassword("")
    setQrCodeDataUrl("")
  }

  async function handleSwitchChange(checked: boolean) {
    setError("")
    if (checked) {
      // Start setup flow: generate secret + QR
      setLoading(true)
      try {
        const res = await fetch("/api/settings/security/2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "setup" }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to start setup")
        setQrCodeDataUrl(data.qrCodeDataUrl)
        setStep("qr")
      } catch (err: any) {
        onToast(err.message || "Something went wrong", "error")
      } finally {
        setLoading(false)
      }
    } else {
      // Turning off — require password confirmation
      setStep("disable")
    }
  }

  async function handleConfirm() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/settings/security/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Invalid code")
      setBackupCodes(data.backupCodes || [])
      onEnabledChange(true)
      setStep("backup-codes")
    } catch (err: any) {
      setError(err.message || "Invalid code")
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/settings/security/2fa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "totp", enabled: false, password: disablePassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to disable")
      onEnabledChange(false)
      onToast("Two-factor authentication disabled", "success")
      resetAndClose()
    } catch (err: any) {
      setError(err.message || "Failed to disable")
    } finally {
      setLoading(false)
    }
  }

  function handleBackupCodesDone() {
    onToast("Two-factor authentication enabled", "success")
    resetAndClose()
  }

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b border-black/5">
        <div>
          <div className="text-xs font-medium text-gray-900">Authenticator app (TOTP)</div>
          <div className="mt-0.5 text-[11px] text-stone-400">
            Use Google Authenticator, Authy, or similar apps
          </div>
        </div>
        <Switch
          checked={enabled}
          disabled={loading}
          onCheckedChange={handleSwitchChange}
          className="data-[state=checked]:bg-emerald-600"
        />
      </div>

      {/* QR + confirm code dialog */}
      <Dialog open={step === "qr"} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Microsoft
              Authenticator, Authy, etc.), then enter the 6-digit code it generates.
            </DialogDescription>
          </DialogHeader>

          {qrCodeDataUrl && (
            <div className="flex justify-center py-4">
              <Image
                src={qrCodeDataUrl}
                alt="2FA QR code"
                width={200}
                height={200}
                unoptimized
              />
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="confirmCode" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Authentication code
            </Label>
            <Input
              id="confirmCode"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setError("")
              }}
              autoFocus
              className="text-center text-lg tracking-widest"
            />
          </div>

          <Button
            onClick={handleConfirm}
            disabled={loading || code.length !== 6}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {loading ? "Verifying…" : "Verify and enable"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Backup codes — shown once after successful setup */}
      <Dialog open={step === "backup-codes"} onOpenChange={(open) => !open && handleBackupCodesDone()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your backup codes</DialogTitle>
            <DialogDescription>
              Store these somewhere safe. Each code can be used once to log in if you lose access
              to your authenticator app.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-4 font-mono text-sm">
            {backupCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <Button onClick={handleBackupCodesDone} className="w-full bg-emerald-600 hover:bg-emerald-700">
            I&apos;ve saved these codes
          </Button>
        </DialogContent>
      </Dialog>

      {/* Disable confirmation dialog */}
      <Dialog open={step === "disable"} onOpenChange={(open) => !open && resetAndClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication</DialogTitle>
            <DialogDescription>
              Enter your password to confirm you want to turn off two-factor authentication.
            </DialogDescription>
          </DialogHeader>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="disablePassword" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Password
            </Label>
            <Input
              id="disablePassword"
              type="password"
              placeholder="••••••••"
              value={disablePassword}
              onChange={(e) => {
                setDisablePassword(e.target.value)
                setError("")
              }}
              autoFocus
            />
          </div>

          <Button
            onClick={handleDisable}
            disabled={loading || !disablePassword}
            variant="destructive"
            className="w-full"
          >
            {loading ? "Disabling…" : "Disable 2FA"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}