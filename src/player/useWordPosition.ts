import { useEffect, useRef, useState } from 'react'
import { tts } from '../tts'
import { WordTimeline, type WordPosition } from '../tts/wordTimeline'
import type { Phase } from './usePlayer'
import type { Highlight } from '../services'

const NONE: WordPosition = { wordIndex: -1, rangeStart: -1 }
/** How far behind the voice the range highlight starts. */
export const RANGE_BEHIND_MS = 1000

/**
 * Follows the voice word by word while a sentence is being spoken.
 * Only ticks when the highlight needs it, to save battery.
 */
export function useWordPosition(phase: Phase, index: number, wordCount: number, speed: number, highlight: Highlight) {
  const [pos, setPos] = useState<WordPosition>(NONE)
  const timeline = useRef(new WordTimeline())
  const active = phase === 'speaking' && (highlight === 'word' || highlight === 'range')

  // Real boundary events from the voice.
  useEffect(() => tts.onWordBoundary((e) => timeline.current.mark(e.wordIndex, e.at)), [])

  useEffect(() => {
    if (!active) return
    const t = timeline.current
    t.start(wordCount, speed, performance.now())
    const id = setInterval(() => setPos(t.at(performance.now(), RANGE_BEHIND_MS)), 80)
    return () => { clearInterval(id); t.stop() }
  }, [active, index, wordCount, speed])

  // While not speaking, the position is simply "none". No state write needed.
  return active ? pos : NONE
}
