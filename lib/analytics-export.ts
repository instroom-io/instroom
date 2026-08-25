// lib/analytics-export.ts
//
// The Analytics export document.
//
// ── Why this is HTML and not CSV ──────────────────────────────────────────────
// A .csv file carries values and nothing else. No bold, no colour, no column
// widths, no merged cells — the format has no place to put them. So a "designed
// CSV" is not a thing that exists, and the raw grid in the screenshot was the
// format doing exactly what it can do.
//
// A real .xlsx would need a spreadsheet library (exceljs, sheetjs); this project
// has none and the export is not worth a megabyte of dependency. The third
// option is the one taken here: emit an HTML table and hand it over with an .xls
// extension. Excel, WPS and LibreOffice all parse that and honour inline CSS —
// fills, borders, font weights, alignment, number formats and column widths —
// which is everything the design needs.
//
// The one cost, stated plainly rather than hidden: Excel shows a one-time "the
// file format and extension don't match" prompt on open, because the bytes are
// HTML. WPS (what the screenshot shows) opens it without complaint.
//
// `toCSV` below is still exported but no longer wired to a button: the export
// action now produces the styled document. Restoring a raw-CSV option is a
// call to toCSV plus downloadFile - the model already carries every section.
//
// ── Shape ────────────────────────────────────────────────────────────────────
// Both renderers read ONE tagged row model, so the styled document and the CSV
// cannot drift apart: a section added for one appears in the other.

"use client"

/** One line of the report. The tag is what lets a renderer style it. */
export type ExportLine =
  | { kind: "section"; title: string }
  /** Column headings for the table that follows. */
  | { kind: "header"; cells: Cell[] }
  | { kind: "row"; cells: Cell[] }
  /** A headline figure, rendered as a card in the styled document. */
  | { kind: "card"; label: string; value: Cell; note?: string }
  /** Opens a row of cards; closed by the next section. */
  | { kind: "cards" }

export type Cell = string | number

/** What the document says it is a snapshot of. */
export type ExportMeta = {
  brandName?: string | null
  brandId: string
  generatedAt: Date
  filters: { search: string; platform: string; niche: string; location: string; dateRange: string }
  scopeCount: number
}

// ─── Palette ─────────────────────────────────────────────────────────────────
// Teal carries structure (title band, section rules, table headings); indigo
// carries the figures. Both are held here so the document reads as one system.
const TEAL_900 = "#0F766E"
const TEAL_700 = "#0D9488"
const TEAL_050 = "#F0FDFA"
const TEAL_200 = "#99F6E4"
const INDIGO_700 = "#4338CA"
const INDIGO_050 = "#EEF2FF"
const INK = "#1E1E1E"
const MUTED = "#6B7280"
const FAINT = "#9CA3AF"
const HAIRLINE = "#E5E7EB"
const ZEBRA = "#FAFAFA"

/** Columns the document is laid out on. Excel reads these as column widths. */
const COL_WIDTHS = [220, 110, 110, 260, 110, 110, 110, 110, 110, 110]

const esc = (v: Cell) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Right-align anything that reads as a figure, so columns line up. */
const isFigure = (v: Cell) =>
  typeof v === "number" || /^-?[\d,]+(\.\d+)?%?$/.test(String(v ?? "").trim()) ||
  /^\$-?[\d,]+(\.\d+)?$/.test(String(v ?? "").trim())

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * The plain grid, unchanged in meaning from the original export.
 *
 * RFC-4180 quoting, and a blank line before each section title — the same shape
 * the previous implementation produced, so anything parsing this file keeps
 * working.
 */
export function toCSV(lines: ExportLine[]): string {
  const cell = (c: Cell) => {
    const text = String(c ?? "")
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const out: string[] = []
  for (const line of lines) {
    if (line.kind === "cards") continue // a presentation-only grouping
    if (line.kind === "section") { out.push("", cell(line.title)); continue }
    if (line.kind === "card") { out.push([line.label, line.value, line.note ?? ""].map(cell).join(",")); continue }
    out.push(line.cells.map(cell).join(","))
  }
  return out.join("\n")
}

// ─── Styled document ─────────────────────────────────────────────────────────

/** A full-width band, used for the title and for section rules. */
const band = (html: string, style: string) =>
  `<tr><td colspan="${COL_WIDTHS.length}" style="${style}">${html}</td></tr>`

const spacer = (h = 10) =>
  `<tr><td colspan="${COL_WIDTHS.length}" style="height:${h}px;border:none;"></td></tr>`

function titleBlock(meta: ExportMeta): string {
  const when = meta.generatedAt.toLocaleString(undefined, {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  })
  const name = meta.brandName?.trim() || meta.brandId
  return (
    band(
      `<span style="font-size:20pt;font-weight:700;color:#FFFFFF;letter-spacing:-0.3px;">Analytics Report</span>`,
      `background:${TEAL_900};padding:14px 16px 4px 16px;border:none;`
    ) +
    band(
      `<span style="font-size:10pt;color:${TEAL_200};">${esc(name)} &nbsp;·&nbsp; ${esc(when)}</span>`,
      `background:${TEAL_900};padding:0 16px 14px 16px;border:none;`
    )
  )
}

/** The filters this snapshot was taken under, as quiet label/value pairs. */
function contextBlock(meta: ExportMeta): string {
  const pairs: [string, string][] = [
    ["Search", meta.filters.search.trim() || "—"],
    ["Platform", meta.filters.platform],
    ["Niche", meta.filters.niche],
    ["Location", meta.filters.location],
    ["Date range", meta.filters.dateRange],
    ["Influencers in scope", String(meta.scopeCount)],
  ]
  const cells = pairs
    .map(
      ([k, v]) =>
        `<td style="background:${TEAL_050};border:none;padding:7px 12px;">` +
        `<span style="font-size:7.5pt;color:${FAINT};letter-spacing:0.8px;text-transform:uppercase;">${esc(k)}</span><br/>` +
        `<span style="font-size:9.5pt;color:${INK};font-weight:600;">${esc(v)}</span></td>`
    )
    .join("")
  // Six pairs across ten columns: pad the remainder so the band runs full width.
  const pad = `<td colspan="${COL_WIDTHS.length - pairs.length}" style="background:${TEAL_050};border:none;"></td>`
  return `<tr>${cells}${pad}</tr>`
}

function sectionTitle(title: string): string {
  return (
    spacer(14) +
    band(
      `<span style="font-size:9pt;font-weight:700;color:${TEAL_900};letter-spacing:1.4px;text-transform:uppercase;">${esc(title)}</span>`,
      `padding:0 0 5px 2px;border:none;border-bottom:2px solid ${TEAL_700};`
    ) +
    spacer(6)
  )
}

/**
 * Headline figures as cards: the number large and indigo, the label quiet above
 * it, an optional basis line below, and a teal rule down the left edge.
 */
function cardRow(cards: Extract<ExportLine, { kind: "card" }>[]): string {
  const cells = cards
    .map(
      (c) =>
        `<td style="border:1px solid ${HAIRLINE};border-left:3px solid ${TEAL_700};` +
        `background:#FFFFFF;padding:9px 12px;vertical-align:top;">` +
        `<span style="font-size:7.5pt;color:${FAINT};letter-spacing:0.8px;text-transform:uppercase;">${esc(c.label)}</span><br/>` +
        `<span style="font-size:16pt;font-weight:700;color:${INDIGO_700};">${esc(c.value)}</span>` +
        (c.note ? `<br/><span style="font-size:7.5pt;color:${MUTED};">${esc(c.note)}</span>` : "") +
        `</td>`
    )
    .join("")
  const pad =
    cards.length < COL_WIDTHS.length
      ? `<td colspan="${COL_WIDTHS.length - cards.length}" style="border:none;"></td>`
      : ""
  return `<tr>${cells}${pad}</tr>` + spacer(4)
}

function headerRow(cells: Cell[]): string {
  const tds = cells
    .map(
      (c, i) =>
        `<td style="background:${INDIGO_050};border-bottom:1px solid ${HAIRLINE};` +
        `padding:6px 10px;font-size:8pt;font-weight:700;color:${INDIGO_700};` +
        `letter-spacing:0.5px;text-transform:uppercase;text-align:${i > 0 ? "right" : "left"};">${esc(c)}</td>`
    )
    .join("")
  return `<tr>${tds}</tr>`
}

function dataRow(cells: Cell[], zebra: boolean): string {
  const tds = cells
    .map(
      (c, i) =>
        `<td style="background:${zebra ? ZEBRA : "#FFFFFF"};` +
        `border-bottom:1px solid ${HAIRLINE};padding:5px 10px;font-size:9.5pt;` +
        `color:${i === 0 ? INK : MUTED};${i === 0 ? "font-weight:600;" : ""}` +
        `text-align:${i > 0 && isFigure(c) ? "right" : "left"};">${esc(c)}</td>`
    )
    .join("")
  return `<tr>${tds}</tr>`
}

/**
 * Render the report as a styled worksheet.
 *
 * The `xmlns:x` block is Excel's own worksheet-options namespace: it is what
 * freezes the header rows so the detail table stays readable when scrolled.
 */
export function toStyledWorkbook(lines: ExportLine[], meta: ExportMeta): string {
  const body: string[] = [titleBlock(meta), contextBlock(meta)]

  let zebra = false
  let pendingCards: Extract<ExportLine, { kind: "card" }>[] | null = null
  // EXPORT CONTEXT stays in the model so the CSV keeps it, but this renderer
  // already shows the same filters as the designed strip under the title. Its
  // rows are skipped here rather than deleted from the model, so neither
  // renderer loses information.
  let skipping = false

  const flushCards = () => {
    if (pendingCards?.length) body.push(cardRow(pendingCards))
    pendingCards = null
  }

  for (const line of lines) {
    switch (line.kind) {
      case "cards":
        flushCards()
        pendingCards = []
        break
      case "card":
        if (pendingCards) pendingCards.push(line)
        else body.push(dataRow([line.label, line.value, line.note ?? ""], (zebra = !zebra)))
        break
      case "section":
        flushCards()
        zebra = false
        skipping = line.title === "EXPORT CONTEXT"
        if (!skipping) body.push(sectionTitle(line.title))
        break
      case "header":
        flushCards()
        zebra = false
        if (!skipping) body.push(headerRow(line.cells))
        break
      case "row":
        flushCards()
        if (!skipping) body.push(dataRow(line.cells, (zebra = !zebra)))
        break
    }
  }
  flushCards()

  const cols = COL_WIDTHS.map((w) => `<col width="${w}"/>`).join("")

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="utf-8"/>
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
  <x:Name>Analytics</x:Name>
  <x:WorksheetOptions><x:FreezePanes/><x:SplitHorizontalValue>3</x:SplitHorizontalValue><x:TopRowBottomPane>3</x:TopRowBottomPane></x:WorksheetOptions>
 </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
 table { border-collapse:collapse; font-family:Calibri,Inter,Arial,sans-serif; }
 td { vertical-align:middle; }
</style>
</head>
<body>
<table>${cols}
${body.join("\n")}
</table>
</body>
</html>`
}

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Hand a generated file to the browser.
 *
 * The anchor is attached before the click and the URL revoked on a later tick:
 * a detached anchor is ignored by Firefox, and revoking synchronously races the
 * browser's own read of the blob. Both were silent no-downloads.
 */
export function downloadFile(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.style.display = "none"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** `instroom_analytics_2026-08-25-00-55-27` — stamped, so exports are distinct. */
export function exportStamp(at: Date): string {
  return at.toISOString().slice(0, 19).replace(/[:T]/g, "-")
}
