import type { Progress } from './types'

export interface ProgressStore {
  load(passageId: string): Promise<Progress | null>
  /** Every passage's place, for the home page. */
  listAll(): Promise<Progress[]>
  save(progress: Progress): Promise<void>
  remove(passageId: string): Promise<void>
}

const KEY = 'sr.progress.all'

export class LocalStorageProgressStore implements ProgressStore {
  private read(): Record<string, Progress> {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Record<string, Progress>) : {}
  }
  private write(map: Record<string, Progress>) {
    localStorage.setItem(KEY, JSON.stringify(map))
  }
  async load(passageId: string): Promise<Progress | null> {
    return this.read()[passageId] ?? null
  }
  async listAll(): Promise<Progress[]> {
    return Object.values(this.read())
  }
  async save(progress: Progress): Promise<void> {
    const map = this.read()
    map[progress.passageId] = { ...progress, updatedAt: new Date().toISOString() }
    this.write(map)
  }
  async remove(passageId: string): Promise<void> {
    const map = this.read()
    delete map[passageId]
    this.write(map)
  }
}
