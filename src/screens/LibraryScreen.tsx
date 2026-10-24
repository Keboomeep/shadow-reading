import { useState } from 'react'
import BottomNav from '../components/BottomNav'
import Cover from '../components/Cover'
import ImportSheet from './ImportSheet'
import { describe } from './progressText'
import type { Passage, PassageSummary, Progress } from '../services'

type Props = {
  library: PassageSummary[]
  progress: Progress[]
  onOpen: (id: string) => void
  onImport: (passage: Passage) => void
  onRemove: (id: string) => void
  onFolder: (id: string, folder: string) => void
  onHome: () => void
}

type Filter = 'all' | 'book' | 'article'

/**
 * The library as a gallery, like WeChat Read: folders first, then covers in a grid.
 * Filters: all, books, articles. Tap a cover to read. The small ⋯ moves or deletes.
 */
export default function LibraryScreen({ library, progress, onOpen, onImport, onRemove, onFolder, onHome }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [openFolder, setOpenFolder] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const progById = new Map(progress.map((p) => [p.passageId, p]))

  const kindOf = (p: PassageSummary) => p.kind ?? (p.cover ? 'book' : 'article')
  const filtered = library.filter((p) => filter === 'all' || kindOf(p) === filter)

  // Folders come first. Inside a folder, show only its texts.
  const folders = new Map<string, PassageSummary[]>()
  const loose: PassageSummary[] = []
  for (const p of filtered) {
    if (p.folder) (folders.get(p.folder) ?? folders.set(p.folder, []).get(p.folder)!).push(p)
    else loose.push(p)
  }
  const items = openFolder ? (folders.get(openFolder) ?? []) : loose

  function menu(p: PassageSummary) {
    const choice = prompt(`"${p.title}"\n\nType a folder name to move it there.\nType "-" to take it out of its folder.\nType "delete" to delete it.`, p.folder ?? '')
    if (choice === null) return
    const c = choice.trim()
    if (c.toLowerCase() === 'delete') { if (confirm(`Delete "${p.title}"?`)) onRemove(p.id); return }
    onFolder(p.id, c === '-' ? '' : c)
  }

  return (
    <div className="screen">
      <header className="topbar">
        {openFolder ? (
          <button className="ghost" onClick={() => setOpenFolder(null)}>‹ Library</button>
        ) : (
          <h1>Library</h1>
        )}
        {openFolder && <span className="ellipsis">{openFolder}</span>}
        <span style={{ width: 56 }} />
      </header>

      {!openFolder && (
        <div className="filters">
          {(['all', 'book', 'article'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'book' ? 'Books' : 'Articles'}
            </button>
          ))}
        </div>
      )}

      <main className="content" style={{ padding: 0 }}>
        {items.length === 0 && folders.size === 0 && <p className="empty">Nothing here yet. Tap + to import.</p>}
        <div className="grid">
          {!openFolder && [...folders.entries()].map(([name, list]) => (
            <button key={`folder:${name}`} className="tile folder" onClick={() => setOpenFolder(name)}>
              <div className="cover">
                {list.slice(0, 4).map((p) => (
                  <div key={p.id} className="mini-cover">{p.cover ? <img src={p.cover} alt="" /> : <Cover passage={p} className="" />}</div>
                ))}
              </div>
              <span className="tile-title">{name}</span>
              <span className="tile-meta">{list.length} {list.length === 1 ? 'text' : 'texts'}</span>
            </button>
          ))}
          {items.map((p) => (
            <div key={p.id} className="tile" style={{ position: 'relative' }}>
              <button className="tile" onClick={() => onOpen(p.id)}>
                <Cover passage={p} />
                <span className="tile-title">{p.title}</span>
                <span className="tile-meta">{describe(p, progById.get(p.id))}</span>
              </button>
              <button className="tile-menu" aria-label={`Options for ${p.title}`} onClick={() => menu(p)}>⋯</button>
            </div>
          ))}
        </div>
      </main>

      <BottomNav tab="library" onTab={(t) => t === 'home' && onHome()} onImport={() => setShowImport(true)} />
      {showImport && <ImportSheet onStart={(p) => { setShowImport(false); onImport(p) }} onClose={() => setShowImport(false)} />}
    </div>
  )
}
