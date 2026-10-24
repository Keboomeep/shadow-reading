import type { PassageSummary, Progress } from '../services'

/** About how long a sentence takes to read aloud at speed 1. */
const SEC_PER_SENTENCE = 4

function timeLeft(sentences: number): string {
  const min = Math.round((sentences * SEC_PER_SENTENCE) / 60)
  if (min < 60) return `${min} min left`
  return `${Math.round(min / 60)} hrs left`
}

/** "3% · 4 hrs left", or "Not started". */
export function describe(p: PassageSummary, prog: Progress | undefined): string {
  const total = p.sentenceCount ?? 0
  const at = prog ? prog.sentenceIndex + 1 : 0
  if (!total) return at > 1 ? `Sentence ${at.toLocaleString()}` : 'Not started'
  const pct = Math.min(100, Math.round((at / total) * 100))
  return `${pct}% · ${timeLeft(total - at)}`
}

/** Sort by last read, newest first. */
export function byRecent(library: PassageSummary[], progress: Progress[]): PassageSummary[] {
  const prog = new Map(progress.map((p) => [p.passageId, p]))
  return [...library].sort((a, b) =>
    (prog.get(b.id)?.updatedAt ?? b.createdAt).localeCompare(prog.get(a.id)?.updatedAt ?? a.createdAt))
}
