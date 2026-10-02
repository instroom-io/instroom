"use client"

// Document renderer for Research SOP sections.
//
// A small, purpose-built Markdown subset — enough to write a real research
// playbook (like the team's Coda SOPs) without adding a dependency:
//
//   # / ## / ###            subheadings inside a section
//   - item / 1. item        lists, nested by indenting two spaces
//   - [ ] / - [x]           checklist items (display only)
//   | a | b |  + |---|      tables
//   > [!DO] Title           coloured callouts: INFO, TIP, DO, DONT, WARNING,
//   > body…                 IMPORTANT, NOTE (a plain "> " quote is a NOTE)
//   ![alt](https://…)       an image / screenshot on its own line
//   ---                     divider
//   **bold** *italic* `code` [link](https://…)  and bare https:// links
//
// Everything is escaped by construction: text reaches the DOM only as React
// text nodes, never as HTML. Links and images accept http(s) (and mailto: for
// links) only, so a pasted `javascript:` URL renders as plain text.

import { Fragment, type ReactNode } from "react"

/* ── Inline ─────────────────────────────────────────────────────────────── */

const SAFE_LINK = /^(https?:\/\/|mailto:)/i
const SAFE_IMAGE = /^https?:\/\//i

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(!?\[[^\]\n]*\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(\*[^*\s\n][^*\n]*\*)|(_[^_\s\n][^_\n]*_)/g

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let n = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push(text.slice(last, start))
    const tok = m[0]
    const key = `${keyPrefix}-${n++}`
    if (m[1]) {
      out.push(<code key={key} className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px] text-gray-800">{tok.slice(1, -1)}</code>)
    } else if (m[2]) {
      out.push(<strong key={key} className="font-semibold text-foreground">{renderInline(tok.slice(2, -2), key)}</strong>)
    } else if (m[3]) {
      const lm = tok.match(/^(!?)\[([^\]]*)\]\(([^)\s]+)\)$/)
      const [, bang, label, url] = lm ?? []
      if (bang) {
        // Inline images are shown as a link; block images render full width.
        out.push(SAFE_IMAGE.test(url) ? <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-[#0F6B3E] underline">{label || "image"}</a> : tok)
      } else if (url && SAFE_LINK.test(url)) {
        out.push(<a key={key} href={url} target="_blank" rel="noopener noreferrer" className="text-[#0F6B3E] underline underline-offset-2 hover:text-[#1FAE5B]">{renderInline(label || url, key)}</a>)
      } else {
        out.push(tok)
      }
    } else if (m[4]) {
      out.push(<a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="break-all text-[#0F6B3E] underline underline-offset-2 hover:text-[#1FAE5B]">{tok}</a>)
    } else {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>)
    }
    last = start + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

type ListItem = { text: string; checked: boolean | null; children: ListNode[] }
type ListNode = { ordered: boolean; start: number; items: ListItem[] }

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; lines: string[] }
  | { kind: "list"; lists: ListNode[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "callout"; type: CalloutType; title: string; blocks: Block[] }
  | { kind: "image"; alt: string; url: string }
  | { kind: "hr" }

const CALLOUTS = {
  info:      { label: "Info",      box: "border-blue-200 bg-blue-50",     title: "text-blue-800" },
  tip:       { label: "Tip",       box: "border-emerald-200 bg-emerald-50", title: "text-emerald-800" },
  do:        { label: "Do",        box: "border-green-300 bg-green-50",   title: "text-green-800" },
  dont:      { label: "Don't",     box: "border-red-300 bg-red-50",       title: "text-red-800" },
  warning:   { label: "Warning",   box: "border-amber-300 bg-amber-50",   title: "text-amber-800" },
  important: { label: "Important", box: "border-purple-200 bg-purple-50", title: "text-purple-800" },
  note:      { label: "Note",      box: "border-gray-200 bg-gray-50",     title: "text-gray-700" },
} as const
type CalloutType = keyof typeof CALLOUTS

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const HEADING_RE = /^(#{1,3})\s+(.+)$/
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const splitRow = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())

function startsBlock(line: string, next?: string): boolean {
  return (
    HEADING_RE.test(line) || LIST_RE.test(line) || line.trimStart().startsWith(">") ||
    IMAGE_RE.test(line.trim()) || /^\s*-{3,}\s*$/.test(line) ||
    (isTableRow(line) && next !== undefined && TABLE_SEP_RE.test(next))
  )
}

function parseList(lines: string[], i: number): [ListNode[], number] {
  const roots: ListNode[] = []
  const stack: { indent: number; node: ListNode }[] = []
  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(LIST_RE)
    if (!m) {
      // A non-blank, indented line continues the previous item.
      if (line.trim() && /^\s+/.test(line) && stack.length) {
        const items = stack[stack.length - 1].node.items
        items[items.length - 1].text += " " + line.trim()
        i++
        continue
      }
      break
    }
    const indent = m[1].replace(/\t/g, "  ").length
    const ordered = /\d/.test(m[2])
    let text = m[3]
    let checked: boolean | null = null
    const task = text.match(/^\[( |x|X)\]\s+(.*)$/)
    if (task) { checked = task[1] !== " "; text = task[2] }

    while (stack.length && indent < stack[stack.length - 1].indent) stack.pop()
    if (!stack.length || indent > stack[stack.length - 1].indent) {
      const node: ListNode = { ordered, start: ordered ? parseInt(m[2], 10) || 1 : 1, items: [] }
      if (stack.length) {
        const parentItems = stack[stack.length - 1].node.items
        parentItems[parentItems.length - 1].children.push(node)
      } else {
        roots.push(node)
      }
      stack.push({ indent, node })
    }
    stack[stack.length - 1].node.items.push({ text, checked, children: [] })
    i++
  }
  return [roots, i]
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { i++; continue }

    const h = trimmed.match(HEADING_RE)
    if (h) { blocks.push({ kind: "heading", level: h[1].length as 1 | 2 | 3, text: h[2] }); i++; continue }

    if (/^-{3,}$/.test(trimmed)) { blocks.push({ kind: "hr" }); i++; continue }

    const img = trimmed.match(IMAGE_RE)
    if (img) { blocks.push({ kind: "image", alt: img[1], url: img[2] }); i++; continue }

    if (trimmed.startsWith(">")) {
      const inner: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        inner.push(lines[i].trim().replace(/^>\s?/, ""))
        i++
      }
      let type: CalloutType = "note"
      let title = ""
      const head = inner[0]?.match(/^\[!(\w+)\]\s*(.*)$/)
      if (head) {
        const t = head[1].toLowerCase().replace(/[^a-z]/g, "")
        type = (t === "donts" ? "dont" : t in CALLOUTS ? t : "note") as CalloutType
        title = head[2]
        inner.shift()
      }
      blocks.push({ kind: "callout", type, title, blocks: parseBlocks(inner.join("\n")) })
      continue
    }

    if (isTableRow(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const header = splitRow(line)
      const rows: string[][] = []
      i += 2
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++ }
      blocks.push({ kind: "table", header, rows })
      continue
    }

    if (LIST_RE.test(line)) {
      const [lists, next] = parseList(lines, i)
      blocks.push({ kind: "list", lists })
      i = next
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) {
      para.push(lines[i].trim())
      i++
    }
    if (para.length) blocks.push({ kind: "paragraph", lines: para })
    else i++
  }
  return blocks
}

/* ── Render ─────────────────────────────────────────────────────────────── */

function renderList(node: ListNode, key: string, depth = 0): ReactNode {
  const items = node.items.map((it, idx) => (
    <li key={idx} className={it.checked !== null ? "list-none" : ""}>
      {it.checked !== null ? (
        <span className="inline-flex items-start gap-2">
          <input type="checkbox" checked={it.checked} readOnly disabled className="mt-1 accent-[#1FAE5B]" />
          <span>{renderInline(it.text, `${key}-${idx}`)}</span>
        </span>
      ) : (
        renderInline(it.text, `${key}-${idx}`)
      )}
      {it.children.map((child, c) => renderList(child, `${key}-${idx}-${c}`, depth + 1))}
    </li>
  ))
  const cls = `my-1.5 flex flex-col gap-1 pl-5 ${depth ? "mt-1" : ""}`
  return node.ordered
    ? <ol key={key} start={node.start} className={`${cls} list-decimal marker:text-gray-500`}>{items}</ol>
    : <ul key={key} className={`${cls} list-disc marker:text-gray-400`}>{items}</ul>
}

function renderBlocks(blocks: Block[], prefix: string): ReactNode[] {
  return blocks.map((b, idx) => {
    const key = `${prefix}-${idx}`
    switch (b.kind) {
      case "heading": {
        const cls = b.level === 1
          ? "mt-3 text-[15px] font-semibold text-foreground"
          : b.level === 2
            ? "mt-3 text-sm font-semibold text-foreground"
            : "mt-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"
        return <p key={key} className={cls}>{renderInline(b.text, key)}</p>
      }
      case "paragraph":
        return (
          <p key={key} className="my-1.5">
            {b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{renderInline(l, `${key}-${j}`)}</Fragment>)}
          </p>
        )
      case "list":
        return <Fragment key={key}>{b.lists.map((l, j) => renderList(l, `${key}-${j}`))}</Fragment>
      case "table":
        return (
          <div key={key} className="my-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-left text-[12.5px]">
              <thead className="bg-gray-50">
                <tr>{b.header.map((c, j) => <th key={j} className="border-b border-gray-200 px-3 py-2 font-semibold text-foreground">{renderInline(c, `${key}-h${j}`)}</th>)}</tr>
              </thead>
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri} className="align-top even:bg-gray-50/50">
                    {b.header.map((_, ci) => (
                      <td key={ci} className="border-b border-gray-100 px-3 py-2">{renderInline(r[ci] ?? "", `${key}-${ri}-${ci}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      case "callout": {
        const style = CALLOUTS[b.type]
        return (
          <div key={key} className={`my-2 rounded-lg border px-3.5 py-2.5 ${style.box}`}>
            <p className={`text-[12px] font-semibold uppercase tracking-wide ${style.title}`}>{b.title ? renderInline(b.title, `${key}-t`) : style.label}</p>
            <div className="text-foreground/85">{renderBlocks(b.blocks, key)}</div>
          </div>
        )
      }
      case "image":
        return SAFE_IMAGE.test(b.url) ? (
          <figure key={key} className="my-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary external reference screenshots */}
            <img src={b.url} alt={b.alt} loading="lazy" className="max-h-[420px] max-w-full rounded-lg border border-gray-200 object-contain" />
            {b.alt && <figcaption className="mt-1 text-[11px] text-muted-foreground">{b.alt}</figcaption>}
          </figure>
        ) : (
          <p key={key} className="my-1.5">{b.alt || b.url}</p>
        )
      case "hr":
        return <hr key={key} className="my-3 border-gray-200" />
    }
  })
}

export function SopMarkdown({ source }: { source: string }) {
  return <div className="text-[13.5px] leading-relaxed text-foreground/80">{renderBlocks(parseBlocks(source), "b")}</div>
}

/* ── Editor helpers ─────────────────────────────────────────────────────── */

/** Snippets the section editor can insert. */
export const SOP_SNIPPETS: { label: string; text: string }[] = [
  { label: "Steps", text: "1. First step\n2. Second step\n   - Detail for step 2\n3. Third step" },
  { label: "Checklist", text: "- [ ] Item to check\n- [ ] Another item" },
  { label: "Do", text: "> [!DO]\n> - What researchers should do" },
  { label: "Don't", text: "> [!DONT]\n> - What researchers must avoid" },
  { label: "Warning", text: "> [!WARNING]\n> Something researchers must be careful about." },
  { label: "Info", text: "> [!INFO] Context\n> Background the researcher needs." },
  { label: "If / then", text: "**If** the primary source is unavailable:\n- Check …\n- Otherwise mark it as uncertain" },
  { label: "Table", text: "| Field | What to record | Example |\n|---|---|---|\n| Location | Country (City if stated) | Philippines |" },
  { label: "Image", text: "![Describe the screenshot](https://)" },
]
