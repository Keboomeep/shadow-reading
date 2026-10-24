import { useState } from 'react'
import BottomNav from '../components/BottomNav'
import Cover from '../components/Cover'
import MiniPlayer from '../components/MiniPlayer'
import ImportSheet from './ImportSheet'
import { byRecent, describe } from './progressText'
import { backend, type Passage, type PassageSummary, type Progress } from '../services'

type Props = {
  library: PassageSummary[]
  progress: Progress[]
  currentId: string | null
  onOpen: (id: string) => void
  onImport: (passage: Passage) => void
  onRemove: (id: string) => void
  onSessions: () => void
  onLibrary: () => void
}


export default function HomeScreen({ library, progress, currentId, onOpen, onImport, onRemove, onSessions, onLibrary }: Props) {
  const [showImport, setShowImport] = useState(false)
  const progById = new Map(progress.map((p) => [p.passageId, p]))
  const recent = byRecent(library, progress)
  const current = library.find((p) => p.id === currentId) ?? recent[0]
  const rest = recent.filter((p) => p.id !== current?.id)

  return (
    <div className="screen">
      <header className="topbar">
        <h1>Home <span className="dim small">{backend === 'supabase' ? 'cloud' : 'this device'}</span></h1>
        <button className="ghost" onClick={onSessions}>Sessions</button>
      </header>

      <main className="content home">
        {!current && <p className="empty">No texts yet. Tap + to import a book or paste something.</p>}

        {current && (
          <button className="card" onClick={() => onOpen(current.id)}>
            <Cover passage={current} />
            <div className="card-text">
              {current.author && <span className="dim small">{current.author}</span>}
              <span className="card-title">{current.title}</span>
              <span className="dim small">{describe(current, progById.get(current.id))}</span>
            </div>
          </button>
        )}

        {rest.map((p) => (
          <div key={p.id} className="history-row">
            <button className="card card-sm grow" onClick={() => onOpen(p.id)}>
              <Cover passage={p} />
              <div className="card-text">
                <span className="card-title">{p.title}</span>
                <span className="dim small">{describe(p, progById.get(p.id))}</span>
              </div>
            </button>
            <button className="ghost round" aria-label={`Delete ${p.title}`} onClick={() => { if (confirm(`Delete "${p.title}"?`)) onRemove(p.id) }}>×</button>
          </div>
        ))}
      </main>

      {current && <MiniPlayer passage={current} meta={describe(current, progById.get(current.id))} onOpen={() => onOpen(current.id)} />}
      <BottomNav tab="home" onTab={(t) => t === 'library' && onLibrary()} onImport={() => setShowImport(true)} />

      {showImport && <ImportSheet onStart={(p) => { setShowImport(false); onImport(p) }} onClose={() => setShowImport(false)} />}
    </div>
  )
}
