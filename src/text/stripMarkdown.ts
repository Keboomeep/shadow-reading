/**
 * Turn a Markdown file into plain text paragraphs.
 *
 * Output: paragraphs separated by one blank line. Headings and list items
 * each become their own paragraph. Code blocks, images, tables separators,
 * HTML tags, and front matter are removed. Link text is kept, the URL is not.
 */
export function stripMarkdown(md: string): string {
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
  const out: string[] = []

  for (const raw of lines) {
    let line = raw.trim()

    // Horizontal rules and table separator rows
    if (/^([-*_]\s*){3,}$/.test(line)) { out.push(''); continue }
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line)) { continue }

    let standalone = false

    // Headings: # Title or Title followed by === is handled as plain text
    const heading = line.match(/^#{1,6}\s+(.*?)\s*#*$/)
    if (heading) { line = heading[1]; standalone = true }

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
      // Own paragraph: blank line before and after
      if (out.length && out[out.length - 1] !== '') out.push('')
      out.push(line, '')
    } else {
      out.push(line)
    }
  }

  // Lines inside a paragraph join with a space; blank lines separate paragraphs.
  const paragraphs: string[] = []
  let current: string[] = []
  for (const line of out) {
    if (line === '') {
      if (current.length) { paragraphs.push(current.join(' ')); current = [] }
    } else {
      current.push(line)
    }
  }
  if (current.length) paragraphs.push(current.join(' '))

  return paragraphs
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
}
