import type { PassageSummary } from '../services'

type Props = { passage: PassageSummary; className?: string }

/** Gradient for texts without a cover. Picked from the title so it stays the same. */
const GRADIENTS = [
  'linear-gradient(180deg, #007aff, #2e3033)',
  'linear-gradient(180deg, #6155f5, #2e3033)',
  'linear-gradient(180deg, #0fb5ae, #2e3033)',
  'linear-gradient(180deg, #e0974a, #2e3033)',
  'linear-gradient(180deg, #c45b7c, #2e3033)',
]
function pick(title: string): string {
  let h = 0
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

/** A book cover, or a colored block with the title for pasted text. */
export default function Cover({ passage, className = '' }: Props) {
  return (
    <div className={`cover ${className}`} style={passage.cover ? undefined : { background: pick(passage.title) }}>
      {passage.cover ? <img src={passage.cover} alt="" /> : <div className="fallback">{passage.title}</div>}
    </div>
  )
}
