import { describe, expect, it } from 'vitest'
import { splitParagraph, splitSentences } from './splitSentences'

const s = splitParagraph

describe('splitParagraph: basic', () => {
  it('splits on period, question, exclamation', () => {
    expect(s('I came. I saw? I left!')).toEqual(['I came.', 'I saw?', 'I left!'])
  })
  it('keeps a single sentence whole', () => {
    expect(s('Just one sentence here')).toEqual(['Just one sentence here'])
  })
  it('returns nothing for empty text', () => {
    expect(s('   ')).toEqual([])
  })
  it('handles runs of marks', () => {
    expect(s('What?! Really!!! Yes.')).toEqual(['What?!', 'Really!!!', 'Yes.'])
  })
  it('does not split when the next word is lowercase', () => {
    expect(s('He paused. then he went on.')).toEqual(['He paused. then he went on.'])
  })
  it('splits before a sentence that starts with a digit', () => {
    expect(s('It ended. 20 people stayed.')).toEqual(['It ended.', '20 people stayed.'])
  })
})

describe('splitParagraph: abbreviations', () => {
  it('Mr. Mrs. Dr.', () => {
    expect(s('Mr. Smith met Dr. Jones. Mrs. Lee waved.')).toEqual([
      'Mr. Smith met Dr. Jones.',
      'Mrs. Lee waved.',
    ])
  })
  it('e.g. and i.e.', () => {
    expect(s('Use fruit, e.g. Apples or pears. That is, i.e. Any fruit.')).toEqual([
      'Use fruit, e.g. Apples or pears.',
      'That is, i.e. Any fruit.',
    ])
  })
  it('U.S. and U.K.', () => {
    expect(s('She moved to the U.S. Then she visited the U.K. Next year.')).toEqual([
      'She moved to the U.S. Then she visited the U.K. Next year.',
    ])
  })
  it('a.m. and p.m.', () => {
    expect(s('We met at 9 a.m. Then we left at 5 p.m. Nobody stayed.')).toEqual([
      'We met at 9 a.m. Then we left at 5 p.m. Nobody stayed.',
    ])
  })
  it('single initials', () => {
    expect(s('J. K. Rowling wrote it. George R. R. Martin did not.')).toEqual([
      'J. K. Rowling wrote it.',
      'George R. R. Martin did not.',
    ])
  })
  it('abbreviation at the very end still closes the paragraph', () => {
    expect(s('Bring pens, paper, etc.')).toEqual(['Bring pens, paper, etc.'])
  })
  it('abbreviation inside an opening quote', () => {
    expect(s('("Dr. Who," she said.) He laughed.')).toEqual(['("Dr. Who," she said.)', 'He laughed.'])
  })
})

describe('splitParagraph: numbers and symbols', () => {
  it('decimals', () => {
    expect(s('Pi is about 3.14 and e is 2.72. Both are irrational.')).toEqual([
      'Pi is about 3.14 and e is 2.72.',
      'Both are irrational.',
    ])
  })
  it('version numbers and domains', () => {
    expect(s('Open example.com in v2.0.1 today. It works.')).toEqual([
      'Open example.com in v2.0.1 today.',
      'It works.',
    ])
  })
  it('money', () => {
    expect(s('It cost $4.99. Cheap.')).toEqual(['It cost $4.99.', 'Cheap.'])
  })
})

describe('splitParagraph: quotes and brackets', () => {
  it('closing quote stays with the sentence', () => {
    expect(s('He said, "Go home." She did.')).toEqual(['He said, "Go home."', 'She did.'])
  })
  it('curly quotes', () => {
    expect(s('He said, “Go home.” She did.')).toEqual(['He said, “Go home.”', 'She did.'])
  })
  it('quote followed by a lowercase tag is one sentence', () => {
    expect(s('"Stop!" he said. "Why?" she asked.')).toEqual(['"Stop!" he said.', '"Why?" she asked.'])
  })
  it('next sentence starting with a quote', () => {
    expect(s('She looked up. "Hello," she said.')).toEqual(['She looked up.', '"Hello," she said.'])
  })
  it('closing parenthesis stays with the sentence', () => {
    expect(s('It rained (a lot). We stayed in.')).toEqual(['It rained (a lot).', 'We stayed in.'])
  })
  it('sentence inside parentheses', () => {
    expect(s('We left early. (It was late.) Nobody minded.')).toEqual([
      'We left early.',
      '(It was late.)',
      'Nobody minded.',
    ])
  })
})

describe('splitParagraph: ellipses', () => {
  it('three dots followed by lowercase does not split', () => {
    expect(s('Well... maybe not. Fine.')).toEqual(['Well... maybe not.', 'Fine.'])
  })
  it('three dots followed by a capital splits', () => {
    expect(s('I waited... Nothing came.')).toEqual(['I waited...', 'Nothing came.'])
  })
  it('unicode ellipsis', () => {
    expect(s('I waited… Nothing came. Then… silence.')).toEqual(['I waited…', 'Nothing came.', 'Then… silence.'])
  })
  it('ellipsis at the end', () => {
    expect(s('And then...')).toEqual(['And then...'])
  })
})

describe('splitSentences: paragraphs', () => {
  it('numbers paragraphs and sentences', () => {
    const r = splitSentences('One. Two.\n\nThree.\nFour. Five.')
    expect(r.map((x) => [x.id, x.paragraph, x.text])).toEqual([
      [0, 0, 'One.'],
      [1, 0, 'Two.'],
      [2, 1, 'Three.'],
      [3, 2, 'Four.'],
      [4, 2, 'Five.'],
    ])
  })
  it('a paragraph break ends a sentence even without a period', () => {
    const r = splitSentences('Chapter One\nIt began.')
    expect(r.map((x) => x.text)).toEqual(['Chapter One', 'It began.'])
  })
  it('collapses inner whitespace and skips blank lines', () => {
    const r = splitSentences('  A   b.  \n\n\n  C d.  ')
    expect(r.map((x) => x.text)).toEqual(['A b.', 'C d.'])
  })
  it('counts words', () => {
    const r = splitSentences('Mr. Smith went to Washington.')
    expect(r[0].words).toEqual(['Mr.', 'Smith', 'went', 'to', 'Washington.'])
  })
  it('handles Windows line endings', () => {
    const r = splitSentences('A.\r\nB.')
    expect(r.map((x) => x.paragraph)).toEqual([0, 1])
  })
})

describe('splitSentences: never cuts mid-sentence on a real paragraph', () => {
  it('article paragraph', () => {
    const text =
      'In 2023, Dr. Maria Chen moved from Boston to the U.K. to study sleep. ' +
      'Her first paper (published in Nature) argued that 7.5 hours is enough for most adults. ' +
      '"We overestimate the need," she said. Critics disagreed... Loudly. ' +
      'By Jan. 2024 the debate had reached the U.S. Senate, where Sen. Ortiz asked, "Is this settled?" It was not.'
    expect(splitSentences(text).map((x) => x.text)).toEqual([
      'In 2023, Dr. Maria Chen moved from Boston to the U.K. to study sleep.',
      'Her first paper (published in Nature) argued that 7.5 hours is enough for most adults.',
      '"We overestimate the need," she said.',
      'Critics disagreed...',
      'Loudly.',
      'By Jan. 2024 the debate had reached the U.S. Senate, where Sen. Ortiz asked, "Is this settled?"',
      'It was not.',
    ])
  })
})
