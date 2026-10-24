"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export type OutreachPreview = {
  paused: boolean
  sender: string | null
  cancelWindowMinutes: number
  intervalMinutes: number
  sample: { subject: string; body: string; to: string; handle: string } | null
  eligibleCount: number
  skipped: { influencerId: string; handle: string; reason: string }[]
}

export type OutreachChoice = "send" | "approve" | "cancel"

/** Shown before an approval when auto outreach is on. */
export function AutoOutreachConfirm({
  preview,
  onChoose,
}: {
  preview: OutreachPreview | null
  onChoose: (choice: OutreachChoice) => void
}) {
  const n = preview?.eligibleCount ?? 0
  const plural = (k: number) => (k === 1 ? "influencer" : "influencers")

  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onChoose("cancel")}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve and send outreach?</DialogTitle>
          <DialogDescription>
            {n > 0
              ? `${n} ${plural(n)} will get your outreach email from ${preview?.sender ?? "the sender mailbox"}, starting in ${preview?.cancelWindowMinutes} min, one every ${preview?.intervalMinutes} min. You can cancel each one on the Pipeline until it sends.`
              : "No one in this selection can get the outreach email."}
          </DialogDescription>
        </DialogHeader>

        {preview?.paused && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Auto outreach is paused. Emails will wait until it&apos;s resumed in Settings → Auto Outreach.
          </p>
        )}

        {preview?.sample && (
          <div className="rounded-lg border bg-muted/30 p-3 text-xs">
            <p className="text-muted-foreground">
              Preview for @{preview.sample.handle} · To: {preview.sample.to}
            </p>
            <p className="mt-2 font-semibold text-foreground">{preview.sample.subject}</p>
            <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-foreground">{preview.sample.body}</p>
          </div>
        )}

        {preview && preview.skipped.length > 0 && (
          <div className="text-xs">
            <p className="font-medium text-foreground">
              {preview.skipped.length} skipped (approved, but no email):
            </p>
            <ul className="mt-1 max-h-24 overflow-y-auto text-muted-foreground">
              {preview.skipped.map((s) => (
                <li key={s.influencerId}>
                  @{s.handle}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onChoose("cancel")}>Cancel</Button>
          <Button variant="outline" onClick={() => onChoose("approve")}>Approve only</Button>
          {n > 0 && (
            <Button className="bg-[#15803d] text-white hover:bg-[#166534]" onClick={() => onChoose("send")}>
              Approve &amp; send
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
