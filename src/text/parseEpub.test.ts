// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { parseEpub } from './parseEpub'

function makeEpub(files: Record<string, string>): ArrayBuffer {
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
}

const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`

const xhtml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>x</title></head><body>${body}</body></html>`

describe('parseEpub', () => {
  it('reads an EPUB 3 book with a nav table of contents', () => {
    const buf = makeEpub({
      'mimetype': 'application/epub+zip',
      'META-INF/container.xml': container,
      'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0">
  <metadata><dc:title>Small Book</dc:title></metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
  </manifest>
  <spine><itemref idref="c1"/><itemref idref="c2"/></spine>
</package>`,
      'OEBPS/nav.xhtml': xhtml(`<nav epub:type="toc"><ol>
        <li><a href="text/ch1.xhtml">One</a></li>
        <li><a href="text/ch2.xhtml#part2">Two, part 2</a></li>
      </ol></nav>`),
      'OEBPS/text/ch1.xhtml': xhtml(`<h1>Chapter One</h1><p>First para. Two sentences.</p><p>Second   para<sup><a epub:type="noteref" href="#n1">1</a></sup>.</p><aside epub:type="footnote" id="n1"><p>A note.</p></aside><img src="a.png"/>`),
      'OEBPS/text/ch2.xhtml': xhtml(`<h1>Chapter Two</h1><p>Opening.</p><section id="part2"><h2>Part 2</h2><p>Deep inside.</p></section>`),
    })
    const book = parseEpub(buf)
    expect(book.title).toBe('Small Book')
    expect(book.text.split('\n\n')).toEqual([
      'Chapter One', 'First para. Two sentences.', 'Second para.',
      'Chapter Two', 'Opening.', 'Part 2', 'Deep inside.',
    ])
    expect(book.chapters).toEqual([
      { title: 'One', paragraph: 0 },
      { title: 'Two, part 2', paragraph: 5 },
    ])
  })

  it('reads an EPUB 2 book with an NCX table of contents', () => {
    const buf = makeEpub({
      'META-INF/container.xml': container,
      'OEBPS/content.opf': `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <metadata><dc:title>Old Book</dc:title></metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="a" href="a.html" media-type="application/xhtml+xml"/>
    <item id="b" href="b.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx"><itemref idref="a"/><itemref idref="b"/></spine>
</package>`,
      'OEBPS/toc.ncx': `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap>
        <navPoint><navLabel><text>Start</text></navLabel><content src="a.html"/></navPoint>
        <navPoint><navLabel><text>Later</text></navLabel><content src="b.html"/></navPoint>
      </navMap></ncx>`,
      'OEBPS/a.html': xhtml('<p>Alpha.</p>'),
      'OEBPS/b.html': xhtml('<p>Beta.</p><p>Gamma.</p>'),
    })
    const book = parseEpub(buf)
    expect(book.title).toBe('Old Book')
    expect(book.text).toBe('Alpha.\n\nBeta.\n\nGamma.')
    expect(book.chapters).toEqual([{ title: 'Start', paragraph: 0 }, { title: 'Later', paragraph: 1 }])
  })

  it('falls back to one section per file when there is no table of contents', () => {
    const buf = makeEpub({
      'META-INF/container.xml': container,
      'OEBPS/content.opf': `<package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/>
  <manifest><item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="a"/><itemref idref="b"/></spine></package>`,
      'OEBPS/a.xhtml': xhtml('<h2>Intro</h2><p>Hi.</p>'),
      'OEBPS/b.xhtml': xhtml('<p>No heading here.</p>'),
    })
    const book = parseEpub(buf)
    expect(book.title).toBe('Untitled')
    expect(book.chapters).toEqual([{ title: 'Intro', paragraph: 0 }, { title: 'Section 2', paragraph: 2 }])
  })

  it('rejects a zip that is not an EPUB', () => {
    expect(() => parseEpub(makeEpub({ 'readme.txt': 'nope' }))).toThrow(/Not an EPUB/)
  })
})
