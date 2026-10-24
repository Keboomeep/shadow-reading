/**
 * Supabase implementations of the four stores. Same interfaces as the
 * localStorage ones, so nothing above the service layer knows the difference.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProgressStore } from './ProgressStore'
import type { SessionLogStore } from './SessionLogStore'
import type { SettingsStore } from './SettingsStore'
import type { TextStore } from './TextStore'
import { DEFAULT_SETTINGS, type Chapter, type Mode, type Passage, type PassageSummary, type Progress, type SessionLog, type Settings } from './types'

const CURRENT_KEY = 'current_passage'
const SETTINGS_KEY = 'settings'

type PassageRow = {
  id: string; title: string; text?: string; chapters: Chapter[]; created_at: string
  sentence_count?: number; kind?: string; author?: string | null; cover?: string | null; folder?: string | null
}

/** Columns added after the first schema. Each may be missing until its migration runs. */
const OPTIONAL_COLUMNS = ['sentence_count', 'kind', 'author', 'cover', 'folder'] as const

/** Which optional column an error complains about, if any. */
function missingColumn(message: string): string | null {
  const m = message.match(/column (?:passages\.)?"?(\w+)"? (?:does not exist|of relation)/i) ?? message.match(/'(\w+)' column/i)
  const col = m?.[1]
  return col && (OPTIONAL_COLUMNS as readonly string[]).includes(col) ? col : null
}

function toSummary(r: PassageRow): PassageSummary {
  return {
    id: r.id, title: r.title, chapters: r.chapters ?? [], createdAt: r.created_at, sentenceCount: r.sentence_count ?? 0,
    kind: (r.kind as PassageSummary['kind']) ?? undefined, author: r.author ?? undefined, cover: r.cover ?? undefined, folder: r.folder ?? undefined,
  }
}
type ProgressRow = { passage_id: string; sentence_index: number; mode: string; updated_at: string }

function rowToProgress(r: ProgressRow): Progress {
  return { passageId: r.passage_id, sentenceIndex: r.sentence_index, mode: r.mode as Mode, updatedAt: r.updated_at }
}

type SessionRow = {
  id: string; passage_id: string; passage_title: string; started_at: string; ended_at: string
  mode: string; minutes: number; back_taps: number; forward_taps: number; restarts: number
}

function fail(what: string, error: { message: string } | null) {
  if (error) throw new Error(`${what}: ${error.message}`)
}

export class SupabaseTextStore implements TextStore {
  private db: SupabaseClient
  constructor(db: SupabaseClient) { this.db = db }

  async list(): Promise<PassageSummary[]> {
    // Everything except the text body. Books are big. Drop columns the database does not have yet.
    let cols = ['id', 'title', 'chapters', 'created_at', ...OPTIONAL_COLUMNS]
    for (;;) {
      const { data, error } = await this.db.from('passages').select(cols.join(', ')).order('created_at', { ascending: false })
      const col = error && missingColumn(error.message)
      if (col) { cols = cols.filter((c) => c !== col); continue }
      fail('list passages', error)
      return ((data ?? []) as unknown as PassageRow[]).map(toSummary)
    }
  }

  async get(id: string): Promise<Passage | null> {
    const { data, error } = await this.db.from('passages').select('*').eq('id', id).maybeSingle()
    fail('read passage', error)
    if (!data) return null
    const row = data as PassageRow
    return { ...toSummary(row), text: row.text ?? '' }
  }

  async save(p: Passage): Promise<void> {
    const row: Record<string, unknown> = {
      id: p.id, title: p.title, text: p.text, chapters: p.chapters ?? [], created_at: p.createdAt,
      sentence_count: p.sentenceCount ?? 0, kind: p.kind ?? 'article', author: p.author ?? null, cover: p.cover ?? null, folder: p.folder ?? null,
    }
    for (;;) {
      const { error } = await this.db.from('passages').upsert(row)
      const col = error && missingColumn(error.message)
      if (col) { delete row[col]; continue }
      fail('save passage', error)
      return
    }
  }

  async setFolder(id: string, folder: string): Promise<void> {
    const { error } = await this.db.from('passages').update({ folder: folder || null }).eq('id', id)
    if (error && missingColumn(error.message)) throw new Error('Folders need the database update in supabase/migrations/003_covers_folders.sql')
    fail('set folder', error)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('passages').delete().eq('id', id)
    fail('delete passage', error)
    if ((await this.currentId()) === id) await this.setCurrent(null)
  }

  async currentId(): Promise<string | null> {
    const { data, error } = await this.db.from('app_state').select('value').eq('key', CURRENT_KEY).maybeSingle()
    fail('read current passage', error)
    return (data?.value as { id?: string } | null)?.id ?? null
  }

  async setCurrent(id: string | null): Promise<void> {
    const { error } = id
      ? await this.db.from('app_state').upsert({ key: CURRENT_KEY, value: { id }, updated_at: new Date().toISOString() })
      : await this.db.from('app_state').delete().eq('key', CURRENT_KEY)
    fail('set current passage', error)
  }
}

export class SupabaseSettingsStore implements SettingsStore {
  private db: SupabaseClient
  constructor(db: SupabaseClient) { this.db = db }

  async load(): Promise<Settings> {
    const { data, error } = await this.db.from('app_state').select('value').eq('key', SETTINGS_KEY).maybeSingle()
    fail('read settings', error)
    return { ...DEFAULT_SETTINGS, ...((data?.value as Partial<Settings> | null) ?? {}) }
  }

  async save(settings: Settings): Promise<void> {
    const { error } = await this.db.from('app_state').upsert({ key: SETTINGS_KEY, value: settings, updated_at: new Date().toISOString() })
    fail('save settings', error)
  }
}

export class SupabaseProgressStore implements ProgressStore {
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: Progress | null = null

  private db: SupabaseClient
  constructor(db: SupabaseClient) { this.db = db }

  async load(passageId: string): Promise<Progress | null> {
    const { data, error } = await this.db.from('progress').select('*').eq('passage_id', passageId).maybeSingle()
    fail('read progress', error)
    if (!data) return null
    return rowToProgress(data as ProgressRow)
  }

  async listAll(): Promise<Progress[]> {
    const { data, error } = await this.db.from('progress').select('*')
    fail('list progress', error)
    return ((data ?? []) as ProgressRow[]).map(rowToProgress)
  }

  async remove(passageId: string): Promise<void> {
    const { error } = await this.db.from('progress').delete().eq('passage_id', passageId)
    fail('delete progress', error)
  }

  /** The reader saves on every sentence. Wait a moment and send only the last one. */
  async save(progress: Progress): Promise<void> {
    this.pending = progress
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 800)
  }

  private async flush() {
    const p = this.pending
    this.pending = null
    this.timer = null
    if (!p) return
    const { error } = await this.db.from('progress').upsert({
      passage_id: p.passageId, sentence_index: p.sentenceIndex, mode: p.mode, updated_at: new Date().toISOString(),
    })
    if (error) console.warn('save progress:', error.message)
  }
}

export class SupabaseSessionLogStore implements SessionLogStore {
  private db: SupabaseClient
  constructor(db: SupabaseClient) { this.db = db }

  async list(): Promise<SessionLog[]> {
    const { data, error } = await this.db.from('sessions').select('*').order('started_at', { ascending: false })
    fail('read sessions', error)
    return ((data ?? []) as SessionRow[]).map((r) => ({
      id: r.id, passageId: r.passage_id, passageTitle: r.passage_title, startedAt: r.started_at, endedAt: r.ended_at,
      mode: r.mode as SessionLog['mode'], minutes: Number(r.minutes), backTaps: r.back_taps, forwardTaps: r.forward_taps, restarts: r.restarts,
    }))
  }

  async upsert(l: SessionLog): Promise<void> {
    const row: SessionRow = {
      id: l.id, passage_id: l.passageId, passage_title: l.passageTitle, started_at: l.startedAt, ended_at: l.endedAt,
      mode: l.mode, minutes: l.minutes, back_taps: l.backTaps, forward_taps: l.forwardTaps, restarts: l.restarts,
    }
    const { error } = await this.db.from('sessions').upsert(row)
    if (error) console.warn('save session:', error.message)
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from('sessions').delete().eq('id', id)
    fail('delete session', error)
  }
}
