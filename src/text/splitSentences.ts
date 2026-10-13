/**
 * Sentence splitter.
 *
 * Rule of thumb: a missed split joins two sentences, which is harmless.
 * A wrong split cuts a sentence in the middle, which is the #1 failure
 * this app must avoid. So every rule below errs toward NOT splitting.
 *
 * A sentence ends at . ! ? or an ellipsis when:
 *   1. the mark is followed by optional closing quotes/brackets,
 *   2. then whitespace (or the end of the paragraph),
 *   3. then the next thing is a capital letter, a digit, or an opening quote,
 *   4. and the word before the mark is not a known abbreviation or a single initial.
 *
 * Paragraphs are separated by one or more newlines. A paragraph break always
 * ends a sentence.
 */

export type Sentence = {
  /** Position in the whole passage, starting at 0. */
  id: number
  text: string
  /** Which paragraph this sentence belongs to, starting at 0. */
  paragraph: number
  words: string[]
}

// Compared lower-case against the token just before the period, without its final dot.
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'ft', 'vs', 'etc',
  'e.g', 'i.e', 'cf', 'fig', 'no', 'vol', 'ca', 'approx', 'dept', 'est', 'inc',
  'ltd', 'co', 'corp', 'gen', 'gov', 'sen', 'rep', 'col', 'lt', 'sgt', 'capt',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'mon', 'tue', 'tues', 'wed', 'thu', 'thur', 'thurs', 'fri', 'sat', 'sun',
  'a.m', 'p.m', 'u.s', 'u.k', 'u.n', 'e.u', 'u.s.a', 'd.c', 'ph.d', 'b.a', 'm.a', 'b.sc', 'm.sc',
])

const TERMINATORS = new Set(['.', '!', '?', '…'])
const CLOSERS = new Set(['"', "'", '”', '’', ')', ']', '}', '»'])
const OPENERS = new Set(['"', "'", '“', '‘', '(', '[', '«'])

function isUpper(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase()
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isSpace(ch: string): boolean {
  return /\s/.test(ch)
}

/** The word right before index `i` (exclusive), without surrounding punctuation. */
function tokenBefore(text: string, i: number): string {
  let start = i
  while (start > 0 && !isSpace(text[start - 1])) start--
  let token = text.slice(start, i)
  // Drop leading opening quotes or brackets, e.g. ("Dr → Dr
  while (token.length && OPENERS.has(token[0])) token = token.slice(1)
  return token
}

function isAbbreviation(token: string): boolean {
  if (!token) return false
  // Single initial: "J." in "J. K. Rowling", or "A." in a list
  if (token.length === 1 && /[A-Za-z]/.test(token)) return true
  return ABBREVIATIONS.has(token.toLowerCase())
}

/** Split one paragraph (no newlines inside) into sentence strings. */
export function splitParagraph(paragraph: string): string[] {
  const text = paragraph.trim()
  if (!text) return []

  const out: string[] = []
  let start = 0
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (!TERMINATORS.has(ch)) { i++; continue }

    // Swallow a run of marks: "...", "?!", "!!!"
    let j = i
    while (j < text.length && TERMINATORS.has(text[j])) j++
    const isDot = ch === '.' && j - i === 1
    const isEllipsis = ch === '…' || (ch === '.' && j - i >= 2)

    // Swallow closing quotes and brackets
    while (j < text.length && CLOSERS.has(text[j])) j++

    // Must be followed by whitespace or the end of the paragraph
    if (j < text.length && !isSpace(text[j])) { i = j; continue }

    // Look at the next non-space character
    let k = j
    while (k < text.length && isSpace(text[k])) k++
    const atEnd = k >= text.length

    if (!atEnd) {
      const next = text[k]
      const startsSentence = isUpper(next) || isDigit(next) || OPENERS.has(next)
      if (!startsSentence) { i = j; continue }
      // An ellipsis before a capital still ends the sentence. A single dot
      // after an abbreviation does not.
      if (isDot && !isEllipsis && isAbbreviation(tokenBefore(text, i))) { i = j; continue }
    }

    out.push(text.slice(start, j).trim())
    start = k
    i = k
  }

  const tail = text.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/** Split a plain-text passage into sentences with paragraph numbers. */
export function splitSentences(passage: string): Sentence[] {
  const paragraphs = passage
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const sentences: Sentence[] = []
  paragraphs.forEach((p, paragraph) => {
    for (const text of splitParagraph(p)) {
      sentences.push({
        id: sentences.length,
        text,
        paragraph,
        words: text.split(' ').filter(Boolean),
      })
    }
  })
  return sentences
}
