import Cover from './Cover'
import type { PassageSummary } from '../services'

type Props = { passage: PassageSummary; meta: string; onOpen: () => void }

/** "Continue reading" bar above the bottom nav. */
export default function MiniPlayer({ passage, meta, onOpen }: Props) {
  return (
    <div style={{ padding: '4px 16px' }}>
      <button className="mini" onClick={onOpen}>
        <Cover passage={passage} />
        <div className="mini-text">
          <span className="ellipsis">{passage.title}</span>
          <span className="dim">{meta}</span>
        </div>
        <img className="chev" src="/icons/chevron.svg" alt="" />
      </button>
    </div>
  )
}
