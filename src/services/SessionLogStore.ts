import type { SessionLog } from './types'

export interface SessionLogStore {
  /** Newest first. */
  list(): Promise<SessionLog[]>
  /** Insert or replace by id. */
  upsert(log: SessionLog): Promise<void>
  remove(id: string): Promise<void>
}

const KEY = 'sr.sessions'

export class LocalStorageSessionLogStore implements SessionLogStore {
  private read(): SessionLog[] {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SessionLog[]) : []
  }
  private write(logs: SessionLog[]) {
    localStorage.setItem(KEY, JSON.stringify(logs))
  }
  async list(): Promise<SessionLog[]> {
    return this.read().sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }
  async upsert(log: SessionLog): Promise<void> {
    const logs = this.read().filter((l) => l.id !== log.id)
    logs.push(log)
    this.write(logs)
  }
  async remove(id: string): Promise<void> {
    this.write(this.read().filter((l) => l.id !== id))
  }
}
