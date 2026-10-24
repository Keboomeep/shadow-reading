import type { Sentence } from '../text/splitSentences'
import type { Loop } from '../services'

/** Which sentence comes after `i`, given the loop setting. null means stop. */
export function nextIndex(sentences: Sentence[], i: number, loop: Loop): number | null {
  const n = sentences.length
  if (n === 0) return null
  switch (loop) {
    case 'sentence':
      return i
    case 'paragraph': {
      const p = sentences[i].paragraph
      if (i + 1 < n && sentences[i + 1].paragraph === p) return i + 1
      return sentences.findIndex((s) => s.paragraph === p)
    }
    case 'all':
      return (i + 1) % n
    case 'off':
    default:
      return i + 1 < n ? i + 1 : null
  }
}
