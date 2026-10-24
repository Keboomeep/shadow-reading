import { describe, expect, it } from 'vitest'
import { nextIndex } from './nextIndex'
import { splitSentences } from '../text/splitSentences'

const s = splitSentences('One. Two.\n\nThree. Four. Five.')

describe('nextIndex', () => {
  it('off goes forward and stops at the end', () => {
    expect(nextIndex(s, 0, 'off')).toBe(1)
    expect(nextIndex(s, 4, 'off')).toBeNull()
  })
  it('sentence repeats', () => {
    expect(nextIndex(s, 3, 'sentence')).toBe(3)
  })
  it('paragraph wraps inside the paragraph', () => {
    expect(nextIndex(s, 2, 'paragraph')).toBe(3)
    expect(nextIndex(s, 4, 'paragraph')).toBe(2)
    expect(nextIndex(s, 1, 'paragraph')).toBe(0)
  })
  it('all wraps to the start', () => {
    expect(nextIndex(s, 4, 'all')).toBe(0)
  })
})
