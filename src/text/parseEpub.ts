/**
 * Reads an EPUB file in the browser. No big library, just unzip and parse.
 *
 * An EPUB is a zip. Inside:
 *   META-INF/container.xml  → points to the OPF file
 *   the OPF file            → title, list of files (manifest), reading order (spine), table of contents
 *   XHTML files             → the chapters
 *
 * We walk the spine in order, pull paragraphs out of each XHTML file, and map
 * the table of contents onto paragraph numbers so the Sections list can jump.
 */
import { unzipSync } from 'fflate'
import type { Chapter } from '../services'

export type ParsedBook = {
  title: string
  author?: string
  /** Raw cover image from the zip, if the book has one. */
  cover?: { bytes: Uint8Array; type: string }
  /** Plain text, paragraphs separated by one blank line. */
  text: string
  chapters: Chapter[]
}

const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, pre, figcaption'
const DROP = 'script, style, nav, img, svg, figure, table, sup, aside, [epub\\:type="noteref"], [epub\\:type="footnote"], [role="doc-noteref"], [role="doc-footnote"]'

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

/** Join a relative href onto the folder of `base`. Handles "../". */
function resolve(base: string, href: string): string {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : ''
  const parts = (dir + decodeURIComponent(href)).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '..') out.pop()
    else if (p !== '.' && p !== '') out.push(p)
  }
  return out.join('/')
}

function splitHref(href: string): { path: string; id: string } {
  const [path, id = ''] = href.split('#')
  return { path, id }
}

/** The text is already decoded, so the <?xml ...?> header only gets in the way of strict parsers. */
function stripXmlHeader(text: string): string {
  return text.replace(/^\s*<\?xml[^>]*\?>/, '')
}

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(stripXmlHeader(text), 'application/xml')
}

function parseHtml(text: string): Document {
  text = stripXmlHeader(text)
  // XHTML is strict; broken files fail as XML. Fall back to the forgiving HTML parser.
  const xml = new DOMParser().parseFromString(text, 'application/xhtml+xml')
  if (!xml.querySelector('parsererror')) return xml
  return new DOMParser().parseFromString(text, 'text/html')
}

type TocEntry = { title: string; href: string }

function readNavToc(doc: Document, navPath: string): TocEntry[] {
  // EPUB 3: <nav epub:type="toc"> ... <a href="...">Title</a>
  const navs = [...doc.querySelectorAll('nav')]
  const toc = navs.find((n) => (n.getAttribute('epub:type') ?? n.getAttributeNS('http://www.idpf.org/2007/ops', 'type')) === 'toc') ?? navs[0]
  if (!toc) return []
  return [...toc.querySelectorAll('a[href]')].map((a) => ({
    title: (a.textContent ?? '').replace(/\s+/g, ' ').trim(),
    href: resolve(navPath, a.getAttribute('href') ?? ''),
  })).filter((e) => e.title)
}

function readNcxToc(doc: Document, ncxPath: string): TocEntry[] {
  // EPUB 2: <navPoint><navLabel><text>Title</text></navLabel><content src="..."/></navPoint>
  return [...doc.querySelectorAll('navPoint')].map((np) => ({
    title: (np.querySelector('navLabel > text')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    href: resolve(ncxPath, np.querySelector('content')?.getAttribute('src') ?? ''),
  })).filter((e) => e.title && e.href)
}

export function parseEpub(buffer: ArrayBuffer): ParsedBook {
  const files = unzipSync(new Uint8Array(buffer))
  const file = (path: string): string | null => (files[path] ? decode(files[path]) : null)

  const container = file('META-INF/container.xml')
  if (!container) throw new Error('Not an EPUB: META-INF/container.xml is missing')
  // Some files use single quotes in the XML header, which trips strict parsers. Fall back to a plain search.
  const opfPath =
    parseXml(container).querySelector('rootfile')?.getAttribute('full-path') ??
    container.match(/full-path\s*=\s*["']([^"']+)["']/)?.[1]
  if (!opfPath) throw new Error('Not an EPUB: no package path in container.xml')
  if (!files[opfPath]) throw new Error('Not an EPUB: package file ' + opfPath + ' is missing')

  const opf = parseXml(file(opfPath)!)
  const title = (opf.getElementsByTagName('dc:title')[0]?.textContent ?? opf.querySelector('title')?.textContent ?? 'Untitled').trim()
  const author = (opf.getElementsByTagName('dc:creator')[0]?.textContent ?? '').replace(/\s+/g, ' ').trim() || undefined

  // Manifest: id → file path
  const manifest = new Map<string, { path: string; type: string; props: string }>()
  for (const item of opf.querySelectorAll('manifest > item')) {
    manifest.set(item.getAttribute('id') ?? '', {
      path: resolve(opfPath, item.getAttribute('href') ?? ''),
      type: item.getAttribute('media-type') ?? '',
      props: item.getAttribute('properties') ?? '',
    })
  }

  // Cover: EPUB 3 marks it with properties="cover-image"; EPUB 2 points at it with <meta name="cover">.
  let cover: ParsedBook['cover']
  const coverId = [...opf.querySelectorAll('metadata > meta')].find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content')
  const coverItem = [...manifest.values()].find((m) => m.props.split(' ').includes('cover-image')) ?? (coverId ? manifest.get(coverId) : undefined)
  if (coverItem && files[coverItem.path] && /^image\//.test(coverItem.type)) cover = { bytes: files[coverItem.path], type: coverItem.type }

  // Spine: reading order
  const spine = [...opf.querySelectorAll('spine > itemref')]
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
    .filter((m): m is NonNullable<typeof m> => !!m && /html|xml/.test(m.type))

  // Table of contents: EPUB 3 nav first, EPUB 2 NCX second
  let toc: TocEntry[] = []
  const nav = [...manifest.values()].find((m) => m.props.split(' ').includes('nav'))
  if (nav && files[nav.path]) toc = readNavToc(parseHtml(file(nav.path)!), nav.path)
  if (toc.length === 0) {
    const ncxId = opf.querySelector('spine')?.getAttribute('toc')
    const ncx = (ncxId && manifest.get(ncxId)) || [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml')
    if (ncx && files[ncx.path]) toc = readNcxToc(parseXml(file(ncx.path)!), ncx.path)
  }

  // Walk the spine. Collect paragraphs and remember where each file and each id starts.
  const paragraphs: { text: string; heading: boolean }[] = []
  const anchor = new Map<string, number>() // "path" or "path#id" → paragraph index

  for (const item of spine) {
    const html = file(item.path)
    if (!html) continue
    const doc = parseHtml(html)
    doc.querySelectorAll(DROP).forEach((el) => el.remove())
    const body = doc.body ?? doc.documentElement
    anchor.set(item.path, paragraphs.length)

    let blocks = [...body.querySelectorAll(BLOCKS)]
    // Drop blocks that contain other blocks (a blockquote holding p's) to avoid double text.
    blocks = blocks.filter((b) => !b.querySelector(BLOCKS))

    if (blocks.length === 0) {
      // No structure at all: split the raw text on line breaks.
      for (const line of (body.textContent ?? '').split(/\n+/)) {
        const t = line.replace(/\s+/g, ' ').trim()
        if (t) paragraphs.push({ text: t, heading: false })
      }
      continue
    }

    for (const b of blocks) {
      // Any element with an id inside or at this block maps to this paragraph.
      const ids = [b, ...b.querySelectorAll('[id]')].map((el) => el.getAttribute('id')).filter(Boolean) as string[]
      // Also ids on wrappers above the block (a <section id="ch1"> around the first <p>).
      let up: Element | null = b.parentElement
      while (up && up !== body) { const id = up.getAttribute('id'); if (id) ids.push(id); up = up.parentElement }
      const t = (b.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (!t) continue
      for (const id of ids) if (!anchor.has(`${item.path}#${id}`)) anchor.set(`${item.path}#${id}`, paragraphs.length)
      paragraphs.push({ text: t, heading: /^h[1-6]$/i.test(b.tagName) })
    }
  }

  // Map the table of contents onto paragraph numbers.
  let chapters: Chapter[] = []
  const seen = new Set<number>()
  for (const e of toc) {
    const { path, id } = splitHref(e.href)
    const p = (id ? anchor.get(`${path}#${id}`) : undefined) ?? anchor.get(path)
    if (p === undefined || seen.has(p)) continue
    seen.add(p)
    chapters.push({ title: e.title, paragraph: p })
  }
  chapters.sort((a, b) => a.paragraph - b.paragraph)

  // No usable table of contents: one section per spine file, named by its first heading.
  if (chapters.length === 0) {
    for (const item of spine) {
      const p = anchor.get(item.path)
      if (p === undefined || seen.has(p) || p >= paragraphs.length) continue
      seen.add(p)
      const head = paragraphs.slice(p, p + 3).find((x) => x.heading)
      chapters.push({ title: head?.text ?? `Section ${chapters.length + 1}`, paragraph: p })
    }
  }

  return { title, author, cover, text: paragraphs.map((p) => p.text).join('\n\n'), chapters }
}
