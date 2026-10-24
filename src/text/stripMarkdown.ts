/**
 * Turn a Markdown file into plain text paragraphs.
 *
 * Output: paragraphs separated by one blank line. Headings and list items
 * each become their own paragraph. Code blocks, images, tables separators,
 * HTML tags, and front matter are removed. Link text is kept, the URL is not.
 */
export type Paragraph = { text: string; heading: boolean }

/** Plain text, paragraphs separated by one blank line. */
export function stripMarkdown(md: string): string {
  return markdownToParagraphs(md).map((p) => p.text).join('\n\n')
}

/** Chapter titles (markdown headings) with the paragraph number they start at. */
export function chaptersFromMarkdown(md: string): { title: string; paragraph: number }[] {
  return markdownToParagraphs(md)
    .map((p, paragraph) => ({ ...p, paragraph }))
    .filter((p) => p.heading)
    .map((p) => ({ title: p.text, paragraph: p.paragraph }))
}

export function markdownToParagraphs(md: string): Paragraph[] {
  let text = md.replace(/\r\n?/g, '\n')

  // Front matter at the very top: --- ... ---
  text = text.replace(/^---\n[\s\S]*?\n---\n?/, '')

  // Fenced code blocks (``` or ~~~) go away entirely. Not readable aloud.
  text = text.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '')

  // HTML comments and tags
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '')

  // Images: ![alt](url) → nothing
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  // Links: [text](url) and [text][ref] → text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
  // Reference definitions: [ref]: url
  text = text.replace(/^\s*\[[^\]]+\]:\s+\S+.*$/gm, '')
  // Autolinks <http://...>
  text = text.replace(/<https?:\/\/[^>]+>/g, '')
  // Footnote markers [^1]
  text = text.replace(/\[\^[^\]]+\]/g, '')

  const lines = text.split('\n')
  // Empty text marks a paragraph break.
  const out: Paragraph[] = []
  const brk = () => out.push({ text: '', heading: false })

  for (const raw of lines) {
    let line = raw.trim()

    // Horizontal rules and table separator rows
    if (/^([-*_]\s*){3,}$/.test(line)) { brk(); continue }
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) { continue }

    let standalone = false
    let isHeading = false

    // Headings: # Title or Title followed by === is handled as plain text
    const heading = line.match(/^#{1,6}\s+(.*?)\s*#*$/)
    if (heading) { line = heading[1]; standalone = true; isHeading = true }

    // Blockquote marks
    line = line.replace(/^(>\s?)+/, '')

    // List markers: - * + or 1. 1)
    const list = line.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/)
    if (list) {
      line = list[1]
      // Task list checkbox
      line = line.replace(/^\[[ xX]\]\s+/, '')
      standalone = true
    }

    // Table rows: drop pipes
    if (line.includes('|')) line = line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim()

    // Inline marks: bold, italic, strikethrough, code
    line = line
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(\*|_)(.+?)\1/g, '$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      // Escaped characters: \* → *
      .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
      .trim()

    if (standalone) {
      // Own paragraph: break before and after
      if (out.length && out[out.length - 1].text !== '') brk()
      out.push({ text: line, heading: isHeading })
      brk()
    } else {
      out.push({ text: line, heading: false })
    }
  }

  // Lines inside a paragraph join with a space; breaks separate paragraphs.
  const paragraphs: Paragraph[] = []
  let current: string[] = []
  let currentHeading = false
  const flush = () => {
    const text = current.join(' ').replace(/\s+/g, ' ').trim()
    if (text) paragraphs.push({ text, heading: currentHeading })
    current = []
    currentHeading = false
  }
  for (const line of out) {
    if (line.text === '') flush()
    else { current.push(line.text); currentHeading = currentHeading || line.heading }
  }
  flush()
  return paragraphs
}
