import type { Passage, PassageSummary } from './types'

/** The library. Many passages, one of them current. */
export interface TextStore {
  /** Newest first. No text bodies. */
  list(): Promise<PassageSummary[]>
  get(id: string): Promise<Passage | null>
  save(passage: Passage): Promise<void>
  remove(id: string): Promise<void>
  currentId(): Promise<string | null>
  setCurrent(id: string | null): Promise<void>
  /** Move a passage into a folder. Empty string removes it from any folder. */
  setFolder(id: string, folder: string): Promise<void>
}

const INDEX = 'sr.library'
const CURRENT = 'sr.current'
const body = (id: string) => `sr.passage.${id}`

export class LocalStorageTextStore implements TextStore {
  private index(): PassageSummary[] {
    const raw = localStorage.getItem(INDEX)
    return raw ? (JSON.parse(raw) as PassageSummary[]) : []
  }
  private writeIndex(list: PassageSummary[]) {
    localStorage.setItem(INDEX, JSON.stringify(list))
  }

  async list(): Promise<PassageSummary[]> {
    return this.index().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }
  async get(id: string): Promise<Passage | null> {
    const summary = this.index().find((p) => p.id === id)
    const text = localStorage.getItem(body(id))
    return summary && text !== null ? { ...summary, text } : null
  }
  async save(passage: Passage): Promise<void> {
    const { text, ...summary } = passage
    localStorage.setItem(body(passage.id), text)
    this.writeIndex([...this.index().filter((p) => p.id !== passage.id), summary])
  }
  async remove(id: string): Promise<void> {
    localStorage.removeItem(body(id))
    this.writeIndex(this.index().filter((p) => p.id !== id))
    if ((await this.currentId()) === id) await this.setCurrent(null)
  }
  async setFolder(id: string, folder: string): Promise<void> {
    this.writeIndex(this.index().map((p) => (p.id === id ? { ...p, folder: folder || undefined } : p)))
  }
  async currentId(): Promise<string | null> {
    return localStorage.getItem(CURRENT)
  }
  async setCurrent(id: string | null): Promise<void> {
    if (id) localStorage.setItem(CURRENT, id)
    else localStorage.removeItem(CURRENT)
  }
}
