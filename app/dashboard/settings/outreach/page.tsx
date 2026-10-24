"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Mail, PauseCircle, Plus, Repeat, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsSkeleton } from "@/components/shared/skeletons"
import { EmailTemplatesModal } from "@/components/shared/email-templates-modal"

type Sender = { accountId: string; provider: "gmail" | "outlook"; email: string | null }
type Config = {
  enabled: boolean
  templateId: string | null
  sender: Sender | null
  cancelWindowMinutes: number
  intervalMinutes: number
  dailyCap: number
  paused: boolean
  pausedReason: string | null
  followUps: { enabled: boolean; steps: { waitDays: number; templateId: string | null }[] }
}
type Template = { id: string; name: string }
type Mailbox = { id: string; provider: "gmail" | "outlook"; email: string | null }

const NEW_TEMPLATE = "__new__"

// Starter outreach template.
const STARTER_TEMPLATE = {
  name: "Outreach",
  subject: "Collaboration with {{brand}}",
  body: [
    "Hi {{first_name}},",
    "",
    "I'm reaching out from {{brand}}. We love your {{platform}} content and think you'd be a great fit for our brand.",
    "",
    "We'd love to send you some of our products to try. If you're open to it, just reply to this email and we'll share the details.",
    "",
    "Looking forward to hearing from you!",
  ].join("\n"),
}

// Starter follow-up template (subject unused: follow-ups reply in the thread).
const STARTER_FOLLOW_UP = {
  name: "Follow-up",
  subject: "Following up",
  body: [
    "Hi {{first_name}},",
    "",
    "Just following up on my last email in case it got buried. We'd still love to work with you at {{brand}}.",
    "",
    "If you're open to it, just reply here and I'll share the details.",
  ].join("\n"),
}
const MAX_FOLLOW_UPS = 3
type StepForm = { waitDays: string; templateId: string }

function LoadingScreen() {
  return <SettingsSkeleton sections={[{ fields: 4 }]} label="Loading auto outreach…" />
}

const providerLabel = (p: "gmail" | "outlook") => (p === "gmail" ? "Gmail" : "Outlook")

function OutreachContent() {
  const brandId = useSearchParams().get("brandId")
  const [config, setConfig] = useState<Config | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [form, setForm] = useState({ templateId: "", senderAccountId: "", cancelWindowMinutes: "5", intervalMinutes: "2", dailyCap: "50" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  // null: closed; "outreach" or a follow-up index.
  const [creatingTemplate, setCreatingTemplate] = useState<null | "outreach" | number>(null)
  const [steps, setSteps] = useState<StepForm[]>([{ waitDays: "3", templateId: "" }])

  useEffect(() => {
    if (!brandId) return
    Promise.all([
      fetch(`/api/brand/${brandId}/auto-outreach`).then((r) => r.json()),
      fetch(`/api/brand/${brandId}/templates`).then((r) => r.json()),
      fetch("/api/mail/accounts").then((r) => (r.ok ? r.json() : { accounts: [] })),
    ])
      .then(([settings, tpl, mail]) => {
        if (settings.error) throw new Error(settings.error)
        const c: Config = settings.config
        setConfig(c)
        setCanEdit(Boolean(settings.canEdit))
        setTemplates(tpl.templates ?? [])
        setMailboxes(mail.accounts ?? [])
        setForm({
          templateId: c.templateId ?? "",
          senderAccountId: c.sender?.accountId ?? "",
          cancelWindowMinutes: String(c.cancelWindowMinutes),
          intervalMinutes: String(c.intervalMinutes),
          dailyCap: String(c.dailyCap),
        })
        setSteps(c.followUps.steps.map((st) => ({ waitDays: String(st.waitDays), templateId: st.templateId ?? "" })))
      })
      .catch((e) => setError(e.message || "Couldn't load auto outreach settings."))
  }, [brandId])

  const save = async (patch: Record<string, unknown>, okMessage: string) => {
    if (!brandId) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/brand/${brandId}/auto-outreach`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Couldn't save.")
      setConfig(data.config)
      toast.success(okMessage)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.")
    } finally {
      setSaving(false)
    }
  }

  if (!brandId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Please select a brand to set up auto outreach.</p>
      </div>
    )
  }
  if (!config && !error) return <LoadingScreen />

  // Keep the saved sender listed even if it isn't the viewer's mailbox.
  const senderOptions: Mailbox[] = [...mailboxes]
  if (config?.sender && !senderOptions.some((m) => m.id === config.sender!.accountId)) {
    senderOptions.unshift({ id: config.sender.accountId, provider: config.sender.provider, email: config.sender.email })
  }

  const saveSettings = () =>
    save(
      {
        templateId: form.templateId || null,
        ...(form.senderAccountId !== (config?.sender?.accountId ?? "") ? { senderAccountId: form.senderAccountId || null } : {}),
        cancelWindowMinutes: Number(form.cancelWindowMinutes),
        intervalMinutes: Number(form.intervalMinutes),
        dailyCap: Number(form.dailyCap),
      },
      "Auto outreach settings saved"
    )

  const followUpsPatch = (enabled: boolean) => ({
    followUps: { enabled, steps: steps.map((st) => ({ waitDays: Number(st.waitDays), templateId: st.templateId || null })) },
  })
  const setStep = (i: number, patch: Partial<StepForm>) =>
    setSteps((prev) => prev.map((st, j) => (j === i ? { ...st, ...patch } : st)))

  return (
    <div className="max-w-3xl px-4 py-5 sm:px-6 sm:py-6 md:px-9 md:py-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Auto Outreach</h1>
        <p className="text-xs text-muted-foreground">
          Send your outreach template automatically when an influencer is approved
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {config?.paused && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <PauseCircle className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">
            <span className="font-medium">Paused.</span> {config.pausedReason || "The sender mailbox needs attention."}
          </span>
          {canEdit && (
            <Button size="sm" variant="outline" disabled={saving} onClick={() => save({ resume: true }, "Auto outreach resumed")}>
              Resume
            </Button>
          )}
        </div>
      )}

      {config && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 border-b px-5 py-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
              <Mail className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight text-foreground">Send on approval</p>
              <p className="text-xs leading-tight text-muted-foreground">
                You confirm each approval first, and can cancel before it sends
              </p>
            </div>
            <Switch
              checked={config.enabled}
              disabled={!canEdit || saving}
              onCheckedChange={(on) => save({ enabled: on }, on ? "Auto outreach is on" : "Auto outreach is off")}
            />
          </div>

          <CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Outreach template</Label>
              {templates.length === 0 ? (
                <Button variant="outline" className="w-full justify-start" disabled={!canEdit} onClick={() => setCreatingTemplate("outreach")}>
                  <Plus className="h-4 w-4" /> Create outreach template
                </Button>
              ) : (
                <Select
                  value={form.templateId}
                  onValueChange={(v) =>
                    v === NEW_TEMPLATE ? setCreatingTemplate("outreach") : setForm((f) => ({ ...f, templateId: v }))
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={NEW_TEMPLATE} className="text-emerald-700">
                      <Plus className="h-4 w-4 text-emerald-700" /> New outreach template
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Send from</Label>
              <Select
                value={form.senderAccountId}
                onValueChange={(v) => setForm((f) => ({ ...f, senderAccountId: v }))}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={senderOptions.length ? "Pick a mailbox" : "Connect a mailbox in the Inbox first"} />
                </SelectTrigger>
                <SelectContent>
                  {senderOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.email ?? "Unknown address"} · {providerLabel(m.provider)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                All outreach for this brand goes out from this mailbox, so replies land in one inbox.
              </p>
            </div>
            <div>
              <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Cancel window (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.cancelWindowMinutes}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, cancelWindowMinutes: e.target.value }))}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                How long the first email waits after approval, so it can still be cancelled.
              </p>
            </div>

            <div>
              <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Minutes between emails</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.intervalMinutes}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, intervalMinutes: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Daily limit</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={form.dailyCap}
                disabled={!canEdit}
                onChange={(e) => setForm((f) => ({ ...f, dailyCap: e.target.value }))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground sm:col-span-2">
              Spacing emails out keeps them out of spam. Anything over the daily limit goes out the next day.
            </p>

            {canEdit ? (
              <div className="sm:col-span-2">
                <Button className="bg-[#15803d] text-white hover:bg-[#166534]" disabled={saving} onClick={saveSettings}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground sm:col-span-2">Only Owners and Managers can change these settings.</p>
            )}
          </CardContent>
        </Card>
      )}

      {config && (
        <Card className="mb-4">
          <div className="flex items-center gap-3 border-b px-5 py-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50">
              <Repeat className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-tight text-foreground">Follow-ups</p>
              <p className="text-xs leading-tight text-muted-foreground">
                If there&apos;s no reply, send a follow-up in the same email thread. Weekdays only; stops when they reply or move on.
              </p>
            </div>
            <Switch
              checked={config.followUps.enabled}
              disabled={!canEdit || saving}
              onCheckedChange={(on) => save(followUpsPatch(on), on ? "Follow-ups are on" : "Follow-ups are off")}
            />
          </div>

          <CardContent className="flex flex-col gap-4 pt-5">
            {steps.map((st, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[110px_1fr_auto]">
                <div>
                  <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">
                    Follow-up {i + 1} after
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={st.waitDays}
                      disabled={!canEdit}
                      onChange={(e) => setStep(i, { waitDays: e.target.value })}
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground">Template</Label>
                  {templates.length === 0 ? (
                    <Button variant="outline" className="w-full justify-start" disabled={!canEdit} onClick={() => setCreatingTemplate(i)}>
                      <Plus className="h-4 w-4" /> Create follow-up template
                    </Button>
                  ) : (
                    <Select
                      value={st.templateId}
                      onValueChange={(v) => (v === NEW_TEMPLATE ? setCreatingTemplate(i) : setStep(i, { templateId: v }))}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={NEW_TEMPLATE} className="text-emerald-700">
                          <Plus className="h-4 w-4 text-emerald-700" /> New follow-up template
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {canEdit && steps.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove follow-up ${i + 1}`}
                    onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ) : (
                  <span className="hidden sm:block sm:w-9" />
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Days are weekdays after the previous email. The template&apos;s subject isn&apos;t used; follow-ups reply in the first email&apos;s thread.
            </p>

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {steps.length < MAX_FOLLOW_UPS && (
                  <Button variant="outline" onClick={() => setSteps((prev) => [...prev, { waitDays: "3", templateId: "" }])}>
                    <Plus className="h-4 w-4" /> Add follow-up
                  </Button>
                )}
                <Button
                  className="bg-[#15803d] text-white hover:bg-[#166534]"
                  disabled={saving}
                  onClick={() => save(followUpsPatch(config.followUps.enabled), "Follow-up settings saved")}
                >
                  {saving ? "Saving…" : "Save follow-ups"}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Only Owners and Managers can change these settings.</p>
            )}
          </CardContent>
        </Card>
      )}

      <EmailTemplatesModal
        isOpen={creatingTemplate !== null}
        onClose={() => setCreatingTemplate(null)}
        brandId={brandId}
        draft={creatingTemplate === "outreach" ? STARTER_TEMPLATE : STARTER_FOLLOW_UP}
        onSaved={(t) => {
          setTemplates((prev) => (prev.some((p) => p.id === t.id) ? prev : [t, ...prev]))
          if (creatingTemplate === "outreach") setForm((f) => ({ ...f, templateId: t.id }))
          else if (typeof creatingTemplate === "number") setStep(creatingTemplate, { templateId: t.id })
        }}
      />
    </div>
  )
}

export default function OutreachSettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <OutreachContent />
    </Suspense>
  )
}
