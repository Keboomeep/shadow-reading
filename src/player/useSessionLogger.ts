import { useCallback, useEffect, useRef } from 'react'
import { services, type Mode, type Passage } from '../services'
import { SessionTracker } from './sessionTracker'
import type { PlayerEvent } from './usePlayer'

/**
 * Wires SessionTracker to the player and saves the log:
 * on every event, every 15 s while open, when the tab hides, and on leaving the reader.
 */
export function useSessionLogger(passage: Passage) {
  const tracker = useRef(new SessionTracker(passage.id, passage.title))
  const state = useRef({ index: 0, mode: 'flow' as Mode })

  const save = useCallback(() => {
    const log = tracker.current.snapshot(Date.now())
    if (log) void services.sessions.upsert(log)
  }, [])

  const onEvent = useCallback((e: PlayerEvent) => {
    const log = tracker.current.onEvent(e, state.current.index, state.current.mode, Date.now())
    if (log) void services.sessions.upsert(log)
  }, [])

  /** The reader calls this whenever the sentence or mode changes. */
  const update = useCallback((index: number, mode: Mode) => {
    state.current = { index, mode }
  }, [])

  useEffect(() => {
    const id = setInterval(save, 15_000)
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', save)
    const t = tracker.current
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', save)
      const log = t.close(Date.now())
      if (log) void services.sessions.upsert(log)
    }
  }, [save])

  return { onEvent, update }
}
