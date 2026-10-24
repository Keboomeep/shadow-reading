import { useRef, useState } from 'react'
import { chaptersFromMarkdown, stripMarkdown } from '../text/stripMarkdown'
import { parseEpub } from '../text/parseEpub'
import { splitSentences } from '../text/splitSentences'
import type { Chapter, Kind, Passage } from '../services'

type Props = {
  onStart: (passage: Passage) => void
  onClose: () => void
}

/** Shrink a cover to about 200×300 so it fits in the database and loads fast. */
async function thumbnail(bytes: Uint8Array, type: string): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }))
    const scale = Math.min(1, 300 / bitmap.height, 200 / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.82)
  } catch {
    return undefined
  }
}

function makeTitle(text: string): string {
  const first = text.split('\n').find((l) => l.trim())?.trim() ?? 'Untitled'
  return first.length > 48 ? first.slice(0, 48) + '…' : first
}

/** Paste text or open a file. Slides up from the home page. */
export default function ImportSheet({ onStart, onClose }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function start(raw: string, title?: string, chapters: Chapter[] = [], extra: { kind?: Kind; author?: string; cover?: string } = {}) {
    const clean = raw.trim()
    if (!clean) return
    onStart({
      id: String(Date.now()),
      title: title ?? makeTitle(clean),
      text: clean,
      createdAt: new Date().toISOString(),
      chapters,
      sentenceCount: splitSentences(clean).length,
      kind: extra.kind ?? 'article',
      author: extra.author,
      cover: extra.cover,
    })
  }

  async function openFile(file: File) {
    const title = file.name.replace(/\.[^.]+$/, '')
    setBusy(true)
    try {
      if (/\.epub$/i.test(file.name)) {
        const book = parseEpub(await file.arrayBuffer())
        const cover = book.cover ? await thumbnail(book.cover.bytes, book.cover.type) : undefined
        start(book.text, book.title || title, book.chapters, { kind: 'book', author: book.author, cover })
      } else if (/\.(md|markdown)$/i.test(file.name)) {
        const raw = await file.text()
        start(stripMarkdown(raw), title, chaptersFromMarkdown(raw))
      } else {
        start(await file.text(), title)
      }
    } catch (e) {
      alert(`Could not open this file. ${e instanceof Error ? e.message : ''}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet import" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <input
          ref={fileRef}
          type="file"
          accept=".epub,.md,.markdown,.txt,application/epub+zip,text/markdown,text/plain"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void openFile(f)
            e.target.value = ''
          }}
        />
        <button className="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Opening…' : 'Open a book or file (.epub, .md, .txt)'}
        </button>

        <div className="dim small" style={{ textAlign: 'center' }}>or</div>

        <textarea placeholder="Paste text here" value={text} onChange={(e) => setText(e.target.value)} rows={7} />
        <div className="row actions">
          <button className="outline" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!text.trim()} onClick={() => start(text)}>Start</button>
        </div>
      </div>
    </div>
  )
}
