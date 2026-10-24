"use client"

// A Research SOP rendered as a readable research playbook — the procedure a
// researcher reads and follows. Shared by Settings → SOPs (View) and the
// influencer profile's Research guide, so it reads the same wherever it opens.
//
// Read-only documentation. It never runs anything and never touches influencer
// data; what a researcher finds is recorded separately, by them.
//
// Data: the SOP's description is its Purpose; each stored step is a SECTION
// (heading + document content written in the subset SopMarkdown renders).

import { useId } from "react"
import { Target } from "lucide-react"
import { SopMarkdown } from "./sop-markdown"

export interface SopDocumentSection {
  id: string
  position: number
  title: string
  instructions: string | null
  notes: string | null
}

export interface SopDocumentData {
  name: string
  description: string | null
  version: number
  updated_at?: string
  steps: SopDocumentSection[]
}

export function SopDocument({ sop }: { sop: SopDocumentData }) {
  const anchor = useId().replace(/:/g, "")
  const sections = sop.steps

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{sop.name}</h2>
          <p className="text-[11px] text-muted-foreground">
            Version {sop.version}
            {sop.updated_at ? ` · Updated ${new Date(sop.updated_at).toLocaleDateString()}` : ""}
          </p>
        </div>
        {sop.description && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-blue-800">
              <Target className="h-3.5 w-3.5" /> Purpose
            </p>
            <div className="mt-1"><SopMarkdown source={sop.description} /></div>
          </div>
        )}
        {sections.length > 2 && (
          <nav aria-label="Contents" className="rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contents</p>
            <ol className="mt-1.5 flex list-decimal flex-col gap-0.5 pl-5 text-[13px] marker:text-gray-400">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${anchor}-${i}`} className="text-[#0F6B3E] hover:underline">{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </header>

      {sections.map((s, i) => (
        <section key={s.id} id={`${anchor}-${i}`} className="scroll-mt-4">
          <h3 className="rounded-md border-l-4 border-[#1FAE5B] bg-[#1FAE5B]/10 px-3 py-2 text-[14px] font-semibold text-[#0F6B3E]">
            {i + 1}. {s.title}
          </h3>
          {s.instructions && <div className="mt-2 px-1"><SopMarkdown source={s.instructions} /></div>}
          {/* Notes from SOPs written before sections had rich content. */}
          {s.notes && <div className="mt-2 px-1"><SopMarkdown source={`> [!NOTE]\n> ${s.notes.replace(/\n/g, "\n> ")}`} /></div>}
        </section>
      ))}
    </article>
  )
}
