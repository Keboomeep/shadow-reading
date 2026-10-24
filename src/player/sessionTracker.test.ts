import { describe, expect, it } from 'vitest'
import { IDLE_MS, SessionTracker } from './sessionTracker'

const T0 = Date.parse('2026-10-12T20:00:00Z')

describe('SessionTracker', () => {
  it('nothing before play', () => {
    const t = new SessionTracker('p', 'T')
    expect(t.onEvent('back', 3, 'flow', T0)).toBeNull()
  })

  it('counts taps and minutes', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    t.onEvent('back', 4, 'flow', T0 + 5000)
    t.onEvent('back', 3, 'flow', T0 + 6000)
    t.onEvent('forward', 4, 'flow', T0 + 7000)
    const log = t.onEvent('pause', 5, 'flow', T0 + 120_000)!
    expect(log.backTaps).toBe(2)
    expect(log.forwardTaps).toBe(1)
    expect(log.minutes).toBe(2)
    expect(log.mode).toBe('flow')
  })

  it('drops sessions shorter than 10 s', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    expect(t.onEvent('pause', 1, 'flow', T0 + 4000)).toBeNull()
    expect(t.close(T0 + 5000)).toBeNull()
  })

  it('pause time is not counted', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    t.onEvent('pause', 2, 'flow', T0 + 30_000)
    t.onEvent('play', 2, 'flow', T0 + 50_000)
    const log = t.close(T0 + 80_000)!
    expect(log.minutes).toBe(1) // 30 s + 30 s
  })

  it('a long pause starts a new session', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    t.onEvent('pause', 5, 'flow', T0 + 30_000)
    t.onEvent('play', 5, 'flow', T0 + 30_000 + IDLE_MS + 1)
    const log = t.close(T0 + 30_000 + IDLE_MS + 20_000)!
    expect(log.startedAt).toBe(new Date(T0 + 30_000 + IDLE_MS + 1).toISOString())
    expect(log.minutes).toBe(0.3)
  })

  it('restart counts: the button, and play from sentence 1 after going further', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    t.onEvent('forward', 6, 'flow', T0 + 1000)
    t.onEvent('restart', 0, 'flow', T0 + 2000)
    t.onEvent('forward', 3, 'flow', T0 + 3000)
    t.onEvent('pause', 3, 'flow', T0 + 15_000)
    const log = t.onEvent('play', 0, 'flow', T0 + 20_000)!
    expect(log.restarts).toBe(2)
  })

  it('switching mode marks the session mixed', () => {
    const t = new SessionTracker('p', 'T')
    t.onEvent('play', 0, 'flow', T0)
    t.onEvent('pause', 1, 'flow', T0 + 15_000)
    const log = t.onEvent('play', 1, 'echo', T0 + 16_000)!
    expect(log.mode).toBe('mixed')
  })
})
