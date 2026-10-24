/**
 * Tracks which word the voice is on, so the "word" and "range" highlights can follow.
 *
 * Real timing comes from boundary events. iOS Safari may never send them,
 * so until the first real event arrives we estimate: about 2.7 words per
 * second at speed 1.0.
 */

export type WordPosition = {
  /** Word being spoken now, or -1. */
  wordIndex: number
  /** Word that was being spoken `behindMs` ago. Start of the range highlight. */
  rangeStart: number
}

export const WORDS_PER_SECOND = 2.7

export class WordTimeline {
  private marks: { wordIndex: number; at: number }[] = []
  private startedAt = 0
  private wordCount = 0
  private msPerWord = 370
  private running = false

  start(wordCount: number, rate: number, now: number) {
    this.marks = []
    this.startedAt = now
    this.wordCount = wordCount
    this.msPerWord = 1000 / (WORDS_PER_SECOND * rate)
    this.running = true
  }

  /** A real word boundary from the voice. */
  mark(wordIndex: number, at: number) {
    if (!this.running) return
    this.marks.push({ wordIndex, at })
  }

  stop() {
    this.running = false
  }

  hasRealTiming(): boolean {
    return this.marks.length > 0
  }

  at(now: number, behindMs = 1000): WordPosition {
    if (!this.running || this.wordCount === 0) return { wordIndex: -1, rangeStart: -1 }

    if (this.marks.length === 0) {
      const elapsed = now - this.startedAt
      const wordIndex = Math.min(this.wordCount - 1, Math.max(0, Math.floor(elapsed / this.msPerWord)))
      const rangeStart = Math.min(wordIndex, Math.max(0, Math.floor((elapsed - behindMs) / this.msPerWord)))
      return { wordIndex, rangeStart }
    }

    const wordIndex = this.marks[this.marks.length - 1].wordIndex
    const cutoff = now - behindMs
    let rangeStart = this.marks[0].wordIndex
    for (const m of this.marks) {
      if (m.at <= cutoff) rangeStart = m.wordIndex
      else break
    }
    return { wordIndex, rangeStart: Math.min(rangeStart, wordIndex) }
  }
}
