import { describe, expect, it } from 'vitest'
import { stripMarkdown } from './stripMarkdown'

describe('stripMarkdown', () => {
  it('headings become their own paragraph', () => {
    expect(stripMarkdown('# Title\nFirst line.\nSecond line.')).toBe('Title\n\nFirst line. Second line.')
  })
  it('bold, italic, code, strikethrough marks are removed', () => {
    expect(stripMarkdown('This is **bold**, *italic*, `code`, and ~~gone~~.')).toBe(
      'This is bold, italic, code, and gone.',
    )
  })
  it('links keep the text, images are dropped', () => {
    expect(stripMarkdown('See [the docs](https://x.com) and ![pic](a.png) here.')).toBe('See the docs and here.')
  })
  it('code fences are removed', () => {
    expect(stripMarkdown('Before.\n\n```js\nlet x = 1\n```\n\nAfter.')).toBe('Before.\n\nAfter.')
  })
  it('list items become paragraphs', () => {
    expect(stripMarkdown('- One thing.\n- Two things.\n1. Three.')).toBe('One thing.\n\nTwo things.\n\nThree.')
  })
  it('blockquote marks are removed', () => {
    expect(stripMarkdown('> Quoted line.\n> More.')).toBe('Quoted line. More.')
  })
  it('front matter and horizontal rules are removed', () => {
    expect(stripMarkdown('---\ntitle: x\n---\nBody.\n\n---\n\nMore.')).toBe('Body.\n\nMore.')
  })
  it('soft line breaks inside a paragraph join with a space', () => {
    expect(stripMarkdown('A long\nparagraph here.\n\nNext one.')).toBe('A long paragraph here.\n\nNext one.')
  })
  it('html tags and comments are removed', () => {
    expect(stripMarkdown('Hello <b>world</b>.<!-- note -->')).toBe('Hello world.')
  })
  it('plain text passes through', () => {
    expect(stripMarkdown('Just text.\n\nTwo paragraphs.')).toBe('Just text.\n\nTwo paragraphs.')
  })
})
