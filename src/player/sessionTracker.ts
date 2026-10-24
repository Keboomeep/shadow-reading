import type { Mode, SessionLog } from '../services'
import type { PlayerEvent } from './usePlayer'

/**
 * Counts one practice session. Pure logic, no React, so it can be tested.
 *
 * A session starts on the first Play. It ends when she pauses for more than
 * IDLE_MS, leaves the reader, or closes the tab. Sessions under MIN_MS are dropped.
 */
export const IDLE_MS = 60_000
export const MIN_MS = 10_000

export class SessionTracker {
  private log: SessionLog | null = null
  private playedMs = 0
  private playingSince: number | null = null
  private pausedAt: number | null = null
  private farthest = 0

  private passageId: string
  private passageTitle: string

  constructor(passageId: string, passageTitle: string) {
    this.passageId = passageId
    this.passageTitle = passageTitle
  }

  /** Feed every player event here. Returns a log to save, or null. */
  onEvent(e: PlayerEvent, index: number, mode: Mode, now: number): SessionLog | null {
    if (e === 'play') {
      if (this.log && this.pausedAt !== null && now - this.pausedAt > IDLE_MS) this.reset()
      if (!this.log) this.start(mode, now)
      else if (this.log.mode !== mode) this.log.mode = 'mixed'
      // Going back to the very top after having been further in counts as a restart.
      if (index === 0 && this.farthest > 0) this.log!.restarts++
      this.playingSince = now
      this.pausedAt = null
    }
    if (!this.log) return null

    if (e === 'pause' || e === 'end') {
      this.accumulate(now)
      this.pausedAt = now
    }
    if (e === 'back') this.log.backTaps++
    if (e === 'forward') this.log.forwardTaps++
    if (e === 'restart') { this.log.restarts++; this.farthest = 0 }

    this.farthest = Math.max(this.farthest, index)
    return this.snapshot(now)
  }

  /** Current state as a log, or null if too short to keep. */
  snapshot(now: number): SessionLog | null {
    if (!this.log) return null
    const total = this.playedMs + (this.playingSince !== null ? now - this.playingSince : 0)
    if (total < MIN_MS) return null
    return { ...this.log, endedAt: new Date(now).toISOString(), minutes: Math.round(total / 6000) / 10 }
  }

  /** Close the session for good. Returns the final log, or null. */
  close(now: number): SessionLog | null {
    this.accumulate(now)
    const out = this.snapshot(now)
    this.reset()
    return out
  }

  private start(mode: Mode, now: number) {
    this.log = {
      id: String(now),
      passageId: this.passageId,
      passageTitle: this.passageTitle,
      startedAt: new Date(now).toISOString(),
      endedAt: new Date(now).toISOString(),
      mode,
      minutes: 0,
      backTaps: 0,
      forwardTaps: 0,
      restarts: 0,
    }
    this.playedMs = 0
    this.farthest = 0
  }

  private accumulate(now: number) {
    if (this.playingSince !== null) {
      this.playedMs += now - this.playingSince
      this.playingSince = null
    }
  }

  private reset() {
    this.log = null
    this.playedMs = 0
    this.playingSince = null
    this.pausedAt = null
    this.farthest = 0
  }
}
