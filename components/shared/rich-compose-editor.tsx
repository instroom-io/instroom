"use client"

// Rich text + attachments box for the inbox's "New Message" compose modal
// (Gmail send path only — see app/dashboard/inbox/page.tsx's sendCompose).
//
// contentEditable is deliberately NOT driven by React on every keystroke: if
// `html` were re-applied via dangerouslySetInnerHTML on every parent
// re-render, the caret would jump to the start of the box after each
// character typed (a well-known contentEditable+React gotcha). Instead, the
// editable div's innerHTML is set ONCE on mount, `onInput` pushes changes OUT
// to the parent's `html` state (write-only from here on), and the one case
// that needs to programmatically replace the content while mounted — applying
// a template — goes through the imperative `setHtml` ref method below.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react"
import {
  IconBold, IconItalic, IconLink, IconMoodSmile, IconPaperclip, IconPhoto, IconX, IconFile,
} from "@tabler/icons-react"
import { EmojiPicker } from "@/components/shared/emoji-picker"

export type PendingAttachment = { id: string; file: File; previewUrl: string | null }

const MAX_FILES = 10

export interface RichComposeEditorHandle {
  /** Imperatively replace the editor's content — used only when applying a
   *  template while the modal is already open. Everything else flows through
   *  the normal onInput → onHtmlChange path. */
  setHtml: (html: string) => void
  focus: () => void
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function ToolbarButton({
  icon: Icon,
  label,
  disabled,
  active,
  onMouseDown,
  onClick,
}: {
  icon: typeof IconBold
  label: string
  disabled?: boolean
  active?: boolean
  onMouseDown?: (e: React.MouseEvent) => void
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown?.(e) }}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? "bg-[#0F6B3E]/10 text-[#0F6B3E]" : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
      }`}
    >
      <Icon size={16} />
    </button>
  )
}

function AttachmentChip({ pending, onRemove }: { pending: PendingAttachment; onRemove: (id: string) => void }) {
  return (
    <div className="relative flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
      {pending.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pending.previewUrl} alt={pending.file.name} className="h-16 w-16 object-cover" />
      ) : (
        <div className="flex h-16 w-[104px] flex-col justify-center gap-0.5 px-2">
          <IconFile size={15} className="text-gray-400" aria-hidden />
          <span className="truncate text-[10.5px] font-medium text-gray-600">{pending.file.name}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => onRemove(pending.id)}
        aria-label={`Remove ${pending.file.name}`}
        className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900/70 text-white transition-colors hover:bg-gray-900"
      >
        <IconX size={11} />
      </button>
    </div>
  )
}

/** Read-only sibling of AttachmentChip, for an attachment that's already been
 *  sent/received (inbox thread view) rather than one still pending upload.
 *  Deliberately no image thumbnail — see rich-compose feature plan: fetching
 *  bytes just to preview an image in a thread list would defeat the point of
 *  fetching attachment bytes lazily, only on click. */
export function AttachmentChipReadOnly({
  filename,
  size,
  onOpen,
  loading,
}: {
  filename: string
  size: number
  onOpen: () => void
  loading?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={loading}
      title={filename}
      className="relative flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition-colors hover:bg-gray-50 disabled:opacity-60"
    >
      <div className="flex h-16 w-[104px] flex-col justify-center gap-0.5 px-2">
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" aria-hidden />
        ) : (
          <IconFile size={15} className="text-gray-400" aria-hidden />
        )}
        <span className="truncate text-[10.5px] font-medium text-gray-600">{filename}</span>
        <span className="text-[9.5px] text-gray-400">{formatAttachmentSize(size)}</span>
      </div>
    </button>
  )
}

function LinkPopover({ onSubmit, onClose }: { onSubmit: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-40 mt-1 w-64 rounded-lg border border-gray-200 bg-white p-2.5 shadow-lg"
    >
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Link URL</label>
      <input
        ref={inputRef}
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && url.trim()) { e.preventDefault(); onSubmit(url.trim()); onClose() }
          if (e.key === "Escape") onClose()
        }}
        placeholder="example.com"
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-[13px] outline-none focus:border-[#0F6B3E]/40"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-gray-500 hover:bg-gray-50">
          Cancel
        </button>
        <button
          type="button"
          disabled={!url.trim()}
          onClick={() => { onSubmit(url.trim()); onClose() }}
          className="rounded-md bg-[#1FAE5B] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export const RichComposeEditor = forwardRef<RichComposeEditorHandle, {
  html: string
  onHtmlChange: (html: string) => void
  files: PendingAttachment[]
  onAddFiles: (files: File[]) => void
  onRemoveFile: (id: string) => void
  /** Disables Bold/Italic/Link/Attach/Photo (typing and emoji still work).
   *  Not currently wired to anything — both Gmail and Outlook support
   *  attachments/formatting — but kept as an escape hatch in case a future
   *  send path can't support the full toolbar. */
  disabled?: boolean
  maxTotalBytes: number
  placeholder?: string
  /** Passed straight through to the editable div — used by the reply box to
   *  keep its existing Enter-to-send / Shift+Enter-for-newline behavior. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  /** Compose wants a large body; the reply box wants something closer to its
   *  old single-line-growing textarea footprint. */
  minHeightPx?: number
  maxHeightPx?: number
  /** Which way the emoji picker opens. Compose sits near the top of its own
   *  modal, so "bottom" (downward, into the body) fits; the reply box sits
   *  near the bottom of the screen, so it wants "top" instead — otherwise
   *  the picker gets pushed down past the visible viewport. */
  emojiPickerSide?: "top" | "bottom"
}>(function RichComposeEditor(
  {
    html, onHtmlChange, files, onAddFiles, onRemoveFile, disabled = false, maxTotalBytes,
    placeholder = "Write your message…", onKeyDown, minHeightPx = 140, maxHeightPx = 320,
    emojiPickerSide = "bottom",
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const attachInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

  const [showLink, setShowLink] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [sizeError, setSizeError] = useState<string | null>(null)
  const [isEmpty, setIsEmpty] = useState(html.trim().length === 0)

  // Set once on mount — see the file-level comment on why this isn't kept in
  // sync with `html` on every render.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = html
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    setHtml: (next: string) => {
      if (editorRef.current) {
        editorRef.current.innerHTML = next
        setIsEmpty(next.trim().length === 0)
        onHtmlChange(next)
      }
    },
    focus: () => editorRef.current?.focus(),
  }))

  // Reflects whether the cursor/selection is currently inside bold/italic
  // text, so the toolbar buttons can show an active state — otherwise
  // there's no way to tell a format is "on" besides the text itself.
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false })

  function updateActiveFormats() {
    const editor = editorRef.current
    const sel = window.getSelection()
    if (!editor || !sel || sel.rangeCount === 0 || !editor.contains(sel.getRangeAt(0).commonAncestorContainer)) return
    setActiveFormats({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic") })
  }

  useEffect(() => {
    document.addEventListener("selectionchange", updateActiveFormats)
    return () => document.removeEventListener("selectionchange", updateActiveFormats)
  }, [])

  function syncFromDom() {
    const el = editorRef.current
    if (!el) return
    setIsEmpty((el.textContent ?? "").trim().length === 0)
    onHtmlChange(el.innerHTML)
  }

  function saveSelectionIfInsideEditor() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function restoreSavedSelection() {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    syncFromDom()
    updateActiveFormats()
  }

  function applyLink(rawUrl: string) {
    restoreSavedSelection()
    const sel = window.getSelection()
    const selectedText = sel?.toString() || ""
    const safeUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    const linkText = selectedText || rawUrl
    document.execCommand(
      "insertHTML",
      false,
      `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`
    )
    syncFromDom()
  }

  function pickEmoji(emoji: string) {
    restoreSavedSelection()
    document.execCommand("insertText", false, emoji)
    syncFromDom()
    setShowEmoji(false)
  }

  function tryAddFiles(newFiles: File[]) {
    if (disabled || newFiles.length === 0) return
    if (files.length + newFiles.length > MAX_FILES) {
      setSizeError(`You can attach up to ${MAX_FILES} files.`)
      return
    }
    const currentTotal = files.reduce((sum, f) => sum + f.file.size, 0)
    const newTotal = newFiles.reduce((sum, f) => sum + f.size, 0)
    if (currentTotal + newTotal > maxTotalBytes) {
      setSizeError(`Attachments must total under ${formatAttachmentSize(maxTotalBytes)}.`)
      return
    }
    setSizeError(null)
    onAddFiles(newFiles)
  }

  return (
    <div
      className={`overflow-visible rounded-2xl border bg-white transition-colors ${
        dragging ? "border-[#1FAE5B] bg-[#1FAE5B]/5" : "border-gray-200"
      }`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (!disabled) tryAddFiles(Array.from(e.dataTransfer.files))
      }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-100 px-2 py-1.5">
        <ToolbarButton icon={IconBold} label="Bold" disabled={disabled} active={activeFormats.bold} onClick={() => runCommand("bold")} />
        <ToolbarButton icon={IconItalic} label="Italic" disabled={disabled} active={activeFormats.italic} onClick={() => runCommand("italic")} />
        <div className="relative">
          <ToolbarButton
            icon={IconLink}
            label="Insert link"
            disabled={disabled}
            onMouseDown={saveSelectionIfInsideEditor}
            onClick={() => setShowLink((v) => !v)}
          />
          {showLink && <LinkPopover onSubmit={applyLink} onClose={() => setShowLink(false)} />}
        </div>
        <div className="mx-1 h-4 w-px bg-gray-200" />
        <div className="relative">
          <ToolbarButton
            icon={IconMoodSmile}
            label="Insert emoji"
            onMouseDown={saveSelectionIfInsideEditor}
            onClick={() => setShowEmoji((v) => !v)}
          />
          {showEmoji && <EmojiPicker onPick={pickEmoji} onClose={() => setShowEmoji(false)} align="left" side={emojiPickerSide} />}
        </div>
        <ToolbarButton
          icon={IconPaperclip}
          label="Attach files"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => attachInputRef.current?.click()}
        />
        <ToolbarButton
          icon={IconPhoto}
          label="Insert photo"
          disabled={disabled || files.length >= MAX_FILES}
          onClick={() => photoInputRef.current?.click()}
        />
        {disabled && (
          <span className="ml-auto pr-1 text-[11px] text-gray-400">Attachments and formatting aren't available here</span>
        )}
      </div>

      <input
        ref={attachInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => { tryAddFiles(Array.from(e.target.files ?? [])); e.target.value = "" }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { tryAddFiles(Array.from(e.target.files ?? [])); e.target.value = "" }}
      />

      {files.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-gray-100 p-2">
          {files.map((f) => (
            <AttachmentChip key={f.id} pending={f} onRemove={onRemoveFile} />
          ))}
        </div>
      )}

      {sizeError && <p className="px-3 pt-2 text-[11px] text-red-500">{sizeError}</p>}

      <div className="relative">
        {isEmpty && (
          <span className="pointer-events-none absolute left-3 top-3 text-sm text-gray-300">{placeholder}</span>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={syncFromDom}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const pastedFiles = Array.from(e.clipboardData.files)
            if (pastedFiles.length > 0) {
              e.preventDefault()
              tryAddFiles(pastedFiles)
            }
            // Otherwise let native contentEditable paste happen; the browser
            // fires its own subsequent `input` event, which syncFromDom picks up.
          }}
          style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
          className="overflow-y-auto px-3 py-3 text-sm text-gray-800 outline-none"
        />
      </div>
    </div>
  )
})
