import { useCallback, useEffect, useMemo, useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import LibraryScreen from './screens/LibraryScreen'
import ReaderScreen from './screens/ReaderScreen'
import SessionsScreen from './screens/SessionsScreen'
import { services, DEFAULT_SETTINGS, type Mode, type Passage, type PassageSummary, type Progress, type SessionLog, type Settings } from './services'
import { splitSentences } from './text/splitSentences'

type Screen = 'home' | 'library' | 'reader' | 'sessions'

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [library, setLibrary] = useState<PassageSummary[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [startIndex, setStartIndex] = useState(0)
  const [startMode, setStartMode] = useState<Mode>('flow')
  const [logs, setLogs] = useState<SessionLog[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshHome = useCallback(async () => {
    const [lib, prog, cur] = await Promise.all([services.texts.list(), services.progress.listAll(), services.texts.currentId()])
    setLibrary(lib)
    setProgress(prog)
    setCurrentId(cur)
  }, [])

  // Load the library and settings once.
  useEffect(() => {
    void (async () => {
      try {
        const s = await services.settings.load()
        setSettings(s)
        await refreshHome()
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
      setReady(true)
    })()
  }, [refreshHome])

  const sentences = useMemo(() => (passage ? splitSentences(passage.text) : []), [passage])

  async function openPassage(id: string) {
    const p = await services.texts.get(id)
    if (!p) return
    const prog = await services.progress.load(id)
    await services.texts.setCurrent(id)
    setPassage(p)
    setStartIndex(prog?.sentenceIndex ?? 0)
    setStartMode(prog?.mode ?? 'flow')
    setScreen('reader')
  }

  async function importPassage(p: Passage) {
    await services.texts.save(p)
    await services.progress.save({ passageId: p.id, sentenceIndex: 0, mode: 'flow' })
    await openPassage(p.id)
  }

  async function removePassage(id: string) {
    await services.texts.remove(id)
    await services.progress.remove(id)
    await refreshHome()
  }

  async function setFolder(id: string, folder: string) {
    try {
      await services.texts.setFolder(id, folder)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
    await refreshHome()
  }

  async function goHome() {
    setScreen('home')
    await refreshHome()
  }

  async function openSessions() {
    setLogs(await services.sessions.list())
    setScreen('sessions')
  }

  if (!ready) return <div className="screen"><p className="dim" style={{ padding: 16 }}>Loading…</p></div>
  if (loadError) return <div className="screen"><p style={{ padding: 16, color: 'var(--danger)' }}>Could not load: {loadError}</p></div>

  if (screen === 'reader' && passage) {
    return (
      <ReaderScreen
        passage={passage}
        sentences={sentences}
        settings={settings}
        onSettings={(s) => { setSettings(s); void services.settings.save(s) }}
        startIndex={startIndex}
        startMode={startMode}
        onBack={() => void goHome()}
      />
    )
  }
  if (screen === 'library') {
    return (
      <LibraryScreen
        library={library}
        progress={progress}
        onOpen={(id) => void openPassage(id)}
        onImport={(p) => void importPassage(p)}
        onRemove={(id) => void removePassage(id)}
        onFolder={(id, f) => void setFolder(id, f)}
        onHome={() => setScreen('home')}
      />
    )
  }
  if (screen === 'sessions') {
    return <SessionsScreen logs={logs} onBack={() => setScreen('home')} />
  }
  return (
    <HomeScreen
      library={library}
      progress={progress}
      currentId={currentId}
      onOpen={(id) => void openPassage(id)}
      onImport={(p) => void importPassage(p)}
      onRemove={(id) => void removePassage(id)}
      onSessions={() => void openSessions()}
      onLibrary={() => setScreen('library')}
    />
  )
}
