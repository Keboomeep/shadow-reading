import { describe, expect, it } from 'vitest'
import { WordTimeline } from './wordTimeline'

describe('WordTimeline', () => {
  it('is empty before start', () => {
    expect(new WordTimeline().at(0)).toEqual({ wordIndex: -1, rangeStart: -1 })
  })

  it('estimates when no boundary events arrive', () => {
    const t = new WordTimeline()
    t.start(10, 1, 0) // 370 ms per word
    expect(t.at(0).wordIndex).toBe(0)
    expect(t.at(1000).wordIndex).toBe(2)
    expect(t.at(1000).rangeStart).toBe(0)
    expect(t.at(2000)).toEqual({ wordIndex: 5, rangeStart: 2 })
    expect(t.at(99999).wordIndex).toBe(9) // never past the last word
  })

  it('estimate follows the speed', () => {
    const t = new WordTimeline()
    t.start(10, 2, 0) // twice as fast
    expect(t.at(1000).wordIndex).toBe(5)
  })

  it('uses real marks when they exist', () => {
    const t = new WordTimeline()
    t.start(6, 1, 0)
    t.mark(0, 0)
    t.mark(1, 400)
    t.mark(2, 800)
    t.mark(3, 1200)
    t.mark(4, 1600)
    // At 1700 ms the voice is on word 4. One second ago (700 ms) it was on word 1.
    expect(t.at(1700)).toEqual({ wordIndex: 4, rangeStart: 1 })
    expect(t.hasRealTiming()).toBe(true)
  })

  it('range start never passes the current word', () => {
    const t = new WordTimeline()
    t.start(6, 1, 0)
    t.mark(0, 0)
    expect(t.at(5000)).toEqual({ wordIndex: 0, rangeStart: 0 })
  })

  it('stop clears the position', () => {
    const t = new WordTimeline()
    t.start(6, 1, 0)
    t.stop()
    expect(t.at(500).wordIndex).toBe(-1)
  })
})
