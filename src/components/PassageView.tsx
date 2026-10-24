import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Sentence } from '../text/splitSentences'
import type { Chapter, Highlight } from '../services'

type Props = {
  sentences: Sentence[]
  chapters: Chapter[]
  current: number
  highlight: Highlight
  /** Index of the word being spoken in the current sentence, or -1. */
  wordIndex: number
  /** First word of the "range" highlight (about 1 s behind), or -1. */
  rangeStart: number
  onPick: (index: number) => void
  /** Full screen: the bars are hidden. A center tap then reveals them instead of picking. */
  immersive: boolean
  onReveal: () => void
}

/** Tap zones: left third = previous page, right third = next page, middle = pick a sentence. */
const ZONE = 0.33
/** Space between pages. Wide enough that no line of the next page peeks in. */
const GAP = 48
/** A swipe shorter than this is a tap. */
const SWIPE = 40
/** Texts without chapters are laid out this many paragraphs at a time. */
const WINDOW = 120

type Range = { from: number; to: number }

/**
 * Which paragraphs to lay out around paragraph `p`: its chapter when the text
 * has chapters, otherwise a window. Laying out a whole book at once takes
 * seconds on a phone, and it would happen again on every resize.
 */
function rangeAround(p: number, paragraphCount: number, chapters: Chapter[]): Range {
  if (paragraphCount <= WINDOW) return { from: 0, to: paragraphCount }
  if (chapters.length) {
    let from = 0
    let to = paragraphCount
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].paragraph <= p) { from = chapters[i].paragraph; to = chapters[i + 1]?.paragraph ?? paragraphCount }
      else break
    }
    return { from, to }
  }
  const from = Math.max(0, Math.floor(p / WINDOW) * WINDOW)
  return { from, to: Math.min(paragraphCount, from + WINDOW) }
}

/**
 * The text as a book: whole pages, flipped left and right.
 *
 * How: the text flows into CSS columns, each one page wide and one page tall.
 * Flipping a page slides the whole flow sideways by one page width.
 * While the voice reads, the page holds still and flips only when the
 * current sentence lands on another page. Only one chapter (or one window of
 * paragraphs) is laid out at a time; flipping past its edge loads the next.
 */
export default function PassageView({ sentences, chapters, current, highlight, wordIndex, rangeStart, onPick, immersive, onReveal }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [page, setPage] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const touch = useRef<{ x: number; y: number; swiped: boolean } | null>(null)
  const [range, setRange] = useState<Range>({ from: 0, to: 0 })
  /** After loading the previous chunk, land on its last page. */
  const landOnLast = useRef(false)

  const paragraphs = useMemo(() => {
    const map = new Map<number, Sentence[]>()
    for (const s of sentences) {
      const list = map.get(s.paragraph) ?? []
      list.push(s)
      map.set(s.paragraph, list)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [sentences])

  const currentParagraph = sentences[current]?.paragraph ?? 0
  const chapterStarts = useMemo(() => new Set(chapters.map((c) => c.paragraph)), [chapters])

  // Keep the laid-out chunk around the current sentence. Only when the sentence
  // moves, so a manual flip into another chapter is not pulled straight back.
  const rangeRef = useRef(range)
  useLayoutEffect(() => { rangeRef.current = range }, [range])
  useLayoutEffect(() => {
    const r = rangeRef.current
    if (currentParagraph >= r.from && currentParagraph < r.to) return
    setRange(rangeAround(currentParagraph, paragraphs.length, chapters))
  }, [currentParagraph, paragraphs.length, chapters])

  const visible = useMemo(() => paragraphs.filter(([p]) => p >= range.from && p < range.to), [paragraphs, range])

  // The chapter of the page on screen, not of the spoken sentence.
  const chapterTitle = useMemo(() => {
    let title = ''
    for (const c of chapters) { if (c.paragraph <= range.from) title = c.title; else break }
    return title
  }, [chapters, range.from])

  // Page size follows the viewport (rotation, keyboard, bottom bar growing in Echo).
  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const measure = () => setSize({ w: vp.clientWidth, h: vp.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(vp)
    return () => ro.disconnect()
  }, [])

  const stride = size.w + GAP

  /** Which page an element's first line sits on. */
  const pageOf = (el: Element): number => {
    const base = pagesRef.current!.getBoundingClientRect().left
    const r = el.getClientRects()[0] ?? el.getBoundingClientRect()
    return Math.max(0, Math.floor((r.left - base + 2) / stride))
  }

  // After layout: count pages, and bring the current sentence's page into view.
  useLayoutEffect(() => {
    const pages = pagesRef.current
    if (!pages || !size.w) return
    const spans = pages.querySelectorAll<HTMLElement>('[data-id]')
    const last = spans[spans.length - 1]
    const count = last ? pageOf(last) + 1 : 1
    setPageCount(count)
    if (landOnLast.current) { landOnLast.current = false; setPage(count - 1); return }
    const here = pages.querySelector<HTMLElement>('.is-here')
    if (here) setPage(pageOf(here))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, size, visible])

  function flip(dir: 1 | -1) {
    const next = page + dir
    if (next >= 0 && next < pageCount) { setPage(next); return }
    // Past the edge of this chunk: load the next or previous one.
    if (dir === 1 && range.to < paragraphs.length) {
      setRange(rangeAround(range.to, paragraphs.length, chapters))
      setPage(0)
    } else if (dir === -1 && range.from > 0) {
      landOnLast.current = true
      setRange(rangeAround(range.from - 1, paragraphs.length, chapters))
    }
  }

  function onTap(e: React.MouseEvent<HTMLDivElement>) {
    if (touch.current?.swiped) { touch.current = null; return }
    const box = viewportRef.current!.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width
    if (x < ZONE) return flip(-1)
    if (x > 1 - ZONE) return flip(1)
    if (immersive) return onReveal()
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id
    if (id !== undefined) onPick(Number(id))
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touch.current = { x: t.clientX, y: t.clientY, swiped: false }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
      start.swiped = true
      flip(dx < 0 ? 1 : -1)
    }
  }

  return (
    <div className="book">
      <div className="book-head dim small ellipsis">{chapterTitle || ' '}</div>

      <div className="book-viewport" ref={viewportRef} onClick={onTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div
          className="book-pages"
          ref={pagesRef}
          style={{
            width: size.w || undefined,
            height: size.h || undefined,
            columnWidth: size.w || undefined,
            columnGap: GAP,
            transform: `translateX(${-page * stride}px)`,
          }}
        >
          {visible.map(([p, list]) => {
            const holdsCurrent = current >= list[0].id && current <= list[list.length - 1].id
            return (
              <Paragraph
                key={p}
                heading={chapterStarts.has(p)}
                list={list}
                current={holdsCurrent ? current : -1}
                highlight={highlight}
                wordIndex={holdsCurrent ? wordIndex : -1}
                rangeStart={holdsCurrent ? rangeStart : -1}
              />
            )
          })}
        </div>
      </div>

      <div className="book-foot dim small">
        <span>{page + 1} / {pageCount}</span>
        <span>{current + 1} / {sentences.length}</span>
      </div>
    </div>
  )
}

type ParagraphProps = { list: Sentence[]; current: number; highlight: Highlight; wordIndex: number; rangeStart: number; heading: boolean }

const Paragraph = memo(function Paragraph({ list, current, highlight, wordIndex, rangeStart, heading }: ParagraphProps) {
  return (
    <p className={heading ? 'heading' : undefined}>
      {list.map((s) => {
        const isCurrent = s.id === current
        const cls = ['sentence', isCurrent && highlight !== 'none' ? 'is-current' : '', isCurrent ? 'is-here' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <span key={s.id} data-id={s.id} className={cls}>
            {isCurrent && (highlight === 'word' || highlight === 'range')
              ? s.words.map((w, i) => {
                  const inRange = highlight === 'range' && rangeStart >= 0 && i >= rangeStart && i < wordIndex
                  const isWord = i === wordIndex
                  return (
                    <span key={i} className={isWord ? 'word is-word' : inRange ? 'word in-range' : 'word'}>
                      {w}{' '}
                    </span>
                  )
                })
              : s.text + ' '}
          </span>
        )
      })}
    </p>
  )
})
