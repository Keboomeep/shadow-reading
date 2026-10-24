type Tab = 'home' | 'library'
type Props = { tab: Tab; onTab: (t: Tab) => void; onImport: () => void }

/** Home, Library, and the + for importing. From the Figma Home frame. */
export default function BottomNav({ tab, onTab, onImport }: Props) {
  return (
    <nav className="nav">
      <button className={tab === 'home' ? 'nav-item on' : 'nav-item'} onClick={() => onTab('home')}>
        <img src="/icons/nav-home.svg" alt="" />
        <span>Home</span>
      </button>
      <button className={tab === 'library' ? 'nav-item on' : 'nav-item'} onClick={() => onTab('library')}>
        <img src="/icons/nav-library.svg" alt="" />
        <span>Library</span>
      </button>
      <button className="nav-plus" onClick={onImport} aria-label="Import">
        <img src="/icons/nav-plus.svg" alt="" />
      </button>
    </nav>
  )
}
