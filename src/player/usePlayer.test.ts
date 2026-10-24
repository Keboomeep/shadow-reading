import { describe, expect, it } from 'vitest'
import { echoPauseMs } from './usePlayer'

describe('echoPauseMs', () => {
  it('words × seconds per word', () => {
    expect(echoPauseMs(10, 0.5)).toBe(5000)
  })
  it('never shorter than 1.5 s', () => {
    expect(echoPauseMs(1, 0.2)).toBe(1500)
  })
})
