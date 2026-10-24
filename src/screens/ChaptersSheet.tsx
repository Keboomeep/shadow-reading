import type { Chapter } from '../services'
import type { Sentence } from '../text/splitSentences'

type Props = {
  chapters: Chapter[]
  sentences: Sentence[]
  current: number
  onPick: (sentenceIndex: number) => void
  onClose: () => void
}

export default function ChaptersSheet({ chapters, sentences, current, onPick, onClose }: Props) {
  const currentParagraph = sentences[current]?.paragraph ?? 0
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="chapters">
          {chapters.map((c, i) => {
            const next = chapters[i + 1]?.paragraph ?? Infinity
            const here = currentParagraph >= c.paragraph && currentParagraph < next
            const first = sentences.findIndex((s) => s.paragraph === c.paragraph)
            return (
              <button key={i} className={here ? 'chapter on' : 'chapter'} disabled={first < 0}
                onClick={() => { onPick(first); onClose() }}>
                {c.title}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
