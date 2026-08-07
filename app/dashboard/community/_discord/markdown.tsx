"use client"
// Discord-flavoured Markdown renderer.
//
// Written by hand rather than pulled from a Markdown library on purpose:
// Discord's dialect is not CommonMark. It has spoilers, its own mention syntax,
// custom emoji, `<t:…>` timestamps, and it deliberately omits things CommonMark
// has (images, tables, reference links). A general parser would render some of
// Discord's syntax as literal text and some of CommonMark's as markup that can
// never appear in a Discord message — wrong in both directions.
//
// Everything is escaped by construction: text only ever reaches the DOM as a
// React text node, never as HTML, so a message cannot inject markup.

import { memo, useState, useMemo, useSyncExternalStore } from "react"
import { IconEyeOff } from "@tabler/icons-react"
import { INSTROOM_GREEN } from "./types"

/* ── Shared clock ─────────────────────────────────────────────────────────── */
// Relative timestamps ("2 hours ago") depend on the current time, which makes
// the wall clock an external mutable source — reading Date.now() during render
// would be impure and, worse, would freeze the label at whenever the component
// last happened to re-render. One interval feeds every timestamp on the page
// through useSyncExternalStore instead, so they all stay correct and there is
// still only a single timer no matter how many messages are on screen.

const TICK_MS = 30_000
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribeClock(onChange: () => void) {
  listeners.add(onChange)
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), TICK_MS)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Bucketed so the snapshot is stable between ticks, as the store contract requires. */
const clockSnapshot = () => Math.floor(Date.now() / TICK_MS)
/** 0 on the server — the renderer falls back to an absolute date for that pass. */
const serverClockSnapshot = () => 0

/** Resolves raw Discord ids into display names for mentions. */
export type MentionResolver = {
  user: (id: string) => string | null
  channel: (id: string) => string | null
  role: (id: string) => string | null
}

const EMPTY_RESOLVER: MentionResolver = {
  user: () => null,
  channel: () => null,
  role: () => null,
}

/* ── Emoji ────────────────────────────────────────────────────────────────── */

// Matches one emoji including multi-codepoint sequences (skin tones, ZWJ
// families, flags). Order matters: the ZWJ alternative must come first or the
// base pictographic would match only the first person in 👨‍👩‍👧.
const EMOJI_SEQUENCE =
  /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|[\u{E0020}-\u{E007F}])*|\p{Regional_Indicator}{2}/gu

/**
 * True when a message is nothing but emoji (and whitespace) — Discord renders
 * those at ~3× size, which is a meaningful part of how the product feels.
 */
function isEmojiOnly(raw: string): boolean {
  const stripped = raw
    .replace(/<a?:\w+:\d+>/g, "") // custom emoji
    .replace(EMOJI_SEQUENCE, "")
    .trim()
  return stripped.length === 0 && raw.trim().length > 0
}

/** Counts emoji so the jumbo treatment is skipped for a long wall of them. */
function emojiCount(raw: string): number {
  const custom = raw.match(/<a?:\w+:\d+>/g)?.length ?? 0
  const unicode = raw.match(EMOJI_SEQUENCE)?.length ?? 0
  return custom + unicode
}

/* ── Search highlighting ──────────────────────────────────────────────────── */

/**
 * Wraps every case-insensitive occurrence of `query` in a <mark>. Applied at
 * the leaf text nodes so a match inside bold or a link still highlights, and
 * highlighting never disturbs the surrounding markup.
 */
function withHighlight(text: string, query: string, keyPrefix: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  if (!lower.includes(needle)) return text

  const out: React.ReactNode[] = []
  let from = 0
  let at = lower.indexOf(needle)
  let n = 0
  while (at !== -1) {
    if (at > from) out.push(text.slice(from, at))
    out.push(
      <mark
        key={`${keyPrefix}-h${n++}`}
        className="rounded-[3px] bg-amber-200/70 px-0.5 text-gray-900"
      >
        {text.slice(at, at + needle.length)}
      </mark>
    )
    from = at + needle.length
    at = lower.indexOf(needle, from)
  }
  if (from < text.length) out.push(text.slice(from))
  return out
}

/* ── Spoiler ──────────────────────────────────────────────────────────────── */

function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      aria-label={revealed ? undefined : "Reveal spoiler"}
      className={
        revealed
          ? "rounded bg-gray-100 px-0.5 text-left"
          : "inline-flex items-center gap-1 rounded bg-gray-800 px-1 text-left align-baseline text-transparent transition-colors hover:bg-gray-700"
      }
    >
      <span className={revealed ? "" : "invisible"}>{children}</span>
      {!revealed && <IconEyeOff size={11} className="flex-shrink-0 text-gray-400" aria-hidden />}
    </button>
  )
}

/* ── Inline parsing ───────────────────────────────────────────────────────── */

// One pass, longest-token-first. `**` must be tried before `*` and `__` before
// `_`, otherwise the opener would match as italic and swallow the wrong span.
const INLINE = new RegExp(
  [
    "```[\\s\\S]*?```", // inline-adjacent fence (block parser normally catches these)
    "`[^`\\n]+`", // code
    "\\|\\|[\\s\\S]+?\\|\\|", // spoiler
    "\\*\\*\\*[^*\\n]+\\*\\*\\*", // bold italic
    "\\*\\*[^*\\n]+\\*\\*", // bold
    "__[^_\\n]+__", // underline
    "~~[^~\\n]+~~", // strikethrough
    "\\*[^*\\n]+\\*", // italic
    "_[^_\\n]+_", // italic
    "<a?:\\w+:\\d+>", // custom emoji
    "<@!?\\d+>", // user mention
    "<@&\\d+>", // role mention
    "<#\\d+>", // channel mention
    "<t:\\d+(?::[tTdDfFR])?>", // timestamp
    "https?://[^\\s<>()]+", // bare link
  ].join("|"),
  "g"
)

const CDN = "https://cdn.discordapp.com"

type InlineCtx = { resolve: MentionResolver; highlight: string; jumbo: boolean }

function mentionPill(label: string, key: string) {
  return (
    <span
      key={key}
      className="rounded bg-[#5865F2]/12 px-1 font-medium text-[#4752C4] transition-colors hover:bg-[#5865F2]/20"
    >
      {label}
    </span>
  )
}

function renderInline(raw: string, ctx: InlineCtx, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let n = 0
  let m: RegExpExecArray | null

  // A fresh lastIndex per call — the regex is module-level and shared.
  INLINE.lastIndex = 0

  while ((m = INLINE.exec(raw))) {
    if (m.index > last) {
      out.push(withHighlight(raw.slice(last, m.index), ctx.highlight, `${keyPrefix}-t${n++}`))
    }
    const t = m[0]
    const key = `${keyPrefix}-${n++}`

    if (t.startsWith("```")) {
      out.push(<CodeBlock key={key} code={t.slice(3, -3).replace(/^\w*\n/, "")} />)
    } else if (t.startsWith("`")) {
      out.push(
        <code
          key={key}
          className="rounded bg-gray-100 px-1 py-[1px] font-mono text-[0.85em] text-gray-800"
        >
          {withHighlight(t.slice(1, -1), ctx.highlight, key)}
        </code>
      )
    } else if (t.startsWith("||")) {
      out.push(<Spoiler key={key}>{renderInline(t.slice(2, -2), ctx, key)}</Spoiler>)
    } else if (t.startsWith("***")) {
      out.push(
        <strong key={key}>
          <em>{renderInline(t.slice(3, -3), ctx, key)}</em>
        </strong>
      )
    } else if (t.startsWith("**")) {
      out.push(<strong key={key} className="font-semibold">{renderInline(t.slice(2, -2), ctx, key)}</strong>)
    } else if (t.startsWith("__")) {
      out.push(<span key={key} className="underline">{renderInline(t.slice(2, -2), ctx, key)}</span>)
    } else if (t.startsWith("~~")) {
      out.push(<s key={key} className="text-gray-400">{renderInline(t.slice(2, -2), ctx, key)}</s>)
    } else if (t.startsWith("*")) {
      out.push(<em key={key}>{renderInline(t.slice(1, -1), ctx, key)}</em>)
    } else if (t.startsWith("_")) {
      out.push(<em key={key}>{renderInline(t.slice(1, -1), ctx, key)}</em>)
    } else if (/^<a?:/.test(t)) {
      const [, animated, name, id] = t.match(/^<(a)?:(\w+):(\d+)>$/) ?? []
      out.push(
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={key}
          src={`${CDN}/emojis/${id}.${animated ? "gif" : "png"}?size=44`}
          alt={`:${name}:`}
          title={`:${name}:`}
          loading="lazy"
          className={`inline-block align-[-0.2em] ${ctx.jumbo ? "h-11 w-11" : "h-[1.375em] w-[1.375em]"}`}
        />
      )
    } else if (t.startsWith("<@&")) {
      const id = t.slice(3, -1)
      out.push(mentionPill(`@${ctx.resolve.role(id) ?? "role"}`, key))
    } else if (t.startsWith("<@")) {
      const id = t.replace(/[^\d]/g, "")
      out.push(mentionPill(`@${ctx.resolve.user(id) ?? "unknown"}`, key))
    } else if (t.startsWith("<#")) {
      const id = t.slice(2, -1)
      out.push(mentionPill(`#${ctx.resolve.channel(id) ?? "unknown"}`, key))
    } else if (t.startsWith("<t:")) {
      out.push(<Timestamp key={key} token={t} />)
    } else {
      out.push(
        <a
          key={key}
          href={t}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all underline decoration-1 underline-offset-2 hover:opacity-80"
          style={{ color: INSTROOM_GREEN }}
        >
          {withHighlight(t, ctx.highlight, key)}
        </a>
      )
    }
    last = m.index + t.length
  }

  if (last < raw.length) {
    out.push(withHighlight(raw.slice(last), ctx.highlight, `${keyPrefix}-t${n}`))
  }
  return out
}

/** `<t:1700000000:R>` — Discord's locale-aware timestamp token. */
function Timestamp({ token }: { token: string }) {
  const tick = useSyncExternalStore(subscribeClock, clockSnapshot, serverClockSnapshot)
  const [, seconds, style = "f"] = token.match(/^<t:(\d+)(?::([tTdDfFR]))?>$/) ?? []
  const date = new Date(Number(seconds) * 1000)
  if (!seconds || Number.isNaN(date.getTime())) return <>{token}</>

  let label: string
  // tick === 0 only on the server pass, where there is no clock to read.
  if (style === "R" && tick !== 0) {
    const diff = date.getTime() - tick * TICK_MS
    const abs = Math.abs(diff)
    const unit: [Intl.RelativeTimeFormatUnit, number] =
      abs < 60_000 ? ["second", 1_000]
      : abs < 3_600_000 ? ["minute", 60_000]
      : abs < 86_400_000 ? ["hour", 3_600_000]
      : abs < 2_592_000_000 ? ["day", 86_400_000]
      : ["month", 2_592_000_000]
    label = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
      Math.round(diff / unit[1]),
      unit[0]
    )
  } else if (style === "t" || style === "T") {
    label = date.toLocaleTimeString(undefined, { timeStyle: style === "T" ? "medium" : "short" })
  } else if (style === "d" || style === "D") {
    label = date.toLocaleDateString(undefined, { dateStyle: style === "D" ? "long" : "short" })
  } else {
    label = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }

  return (
    <span
      title={date.toLocaleString()}
      className="rounded bg-gray-100 px-1 text-gray-600"
    >
      {label}
    </span>
  )
}

/* ── Code block ───────────────────────────────────────────────────────────── */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="my-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
      {lang && (
        <div className="border-b border-gray-200 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-gray-400">
          {lang}
        </div>
      )}
      {/* Long lines scroll inside the block rather than widening the message column. */}
      <pre className="overflow-x-auto px-2.5 py-2">
        <code className="font-mono text-[12px] leading-relaxed text-gray-800">{code}</code>
      </pre>
    </div>
  )
}

/* ── Block parsing ────────────────────────────────────────────────────────── */

type Block =
  | { kind: "code"; code: string; lang?: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; items: { text: string; ordered: boolean; depth: number }[] }
  | { kind: "para"; text: string }

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = []
  const lines = raw.split("\n")
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code — consumed first so no inline rule can touch its contents.
    const fence = line.match(/^```(\w+)?\s*$/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++])
      i++ // closing fence
      blocks.push({ kind: "code", code: body.join("\n"), lang: fence[1] })
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 1 | 2 | 3,
        text: heading[2],
      })
      i++
      continue
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) quoted.push(lines[i++].replace(/^>\s?/, ""))
      blocks.push({ kind: "quote", lines: quoted })
      continue
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: { text: string; ordered: boolean; depth: number }[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)!
        items.push({
          text: m[3],
          ordered: /\d/.test(m[2]),
          // Two spaces per level, capped so deep nesting can't push text out.
          depth: Math.min(Math.floor(m[1].length / 2), 3),
        })
        i++
      }
      blocks.push({ kind: "list", items })
      continue
    }

    // Consecutive plain lines stay one paragraph so `white-space: pre-wrap`
    // preserves the author's own line breaks without extra vertical gaps.
    const para: string[] = []
    while (
      i < lines.length &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^#{1,3}\s/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    ) {
      para.push(lines[i++])
    }
    if (para.length) blocks.push({ kind: "para", text: para.join("\n") })
  }

  return blocks
}

/* ── Public component ─────────────────────────────────────────────────────── */

export const RichText = memo(function RichText({
  content,
  resolve = EMPTY_RESOLVER,
  highlight = "",
}: {
  content: string
  resolve?: MentionResolver
  highlight?: string
}) {
  const blocks = useMemo(() => parseBlocks(content), [content])
  // Up to ~27 emoji get the jumbo treatment; past that it's a wall, not a
  // reaction, and giant glyphs would break the message rhythm.
  const jumbo = useMemo(() => isEmojiOnly(content) && emojiCount(content) <= 27, [content])

  const ctx: InlineCtx = { resolve, highlight, jumbo }

  return (
    <div
      className={`min-w-0 break-words ${
        jumbo ? "text-[2.5rem] leading-[1.15]" : "text-[13.5px] leading-[1.4]"
      } text-gray-700`}
    >
      {blocks.map((b, bi) => {
        if (b.kind === "code") return <CodeBlock key={bi} code={b.code} lang={b.lang} />

        if (b.kind === "heading") {
          const size = b.level === 1 ? "text-[17px]" : b.level === 2 ? "text-[15px]" : "text-[14px]"
          return (
            <div key={bi} className={`${size} mb-0.5 mt-1 font-semibold text-gray-900`}>
              {renderInline(b.text, ctx, `b${bi}`)}
            </div>
          )
        }

        if (b.kind === "quote") {
          return (
            <blockquote
              key={bi}
              className="my-0.5 border-l-[3px] border-gray-300 pl-2.5 text-gray-600"
            >
              <div className="whitespace-pre-wrap">
                {renderInline(b.lines.join("\n"), ctx, `b${bi}`)}
              </div>
            </blockquote>
          )
        }

        if (b.kind === "list") {
          return (
            <ul key={bi} className="my-0.5 flex flex-col gap-0.5">
              {b.items.map((it, ii) => (
                <li
                  key={ii}
                  className="flex gap-1.5"
                  style={{ paddingLeft: `${it.depth * 0.875}rem` }}
                >
                  <span aria-hidden className="select-none text-gray-400">
                    {it.ordered ? `${ii + 1}.` : "•"}
                  </span>
                  <span className="min-w-0">{renderInline(it.text, ctx, `b${bi}i${ii}`)}</span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <div key={bi} className="whitespace-pre-wrap">
            {renderInline(b.text, ctx, `b${bi}`)}
          </div>
        )
      })}
    </div>
  )
})
