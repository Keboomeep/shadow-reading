import { beforeEach, describe, expect, it } from 'vitest'
import { LocalStorageProgressStore } from './ProgressStore'
import { LocalStorageSessionLogStore } from './SessionLogStore'
import { LocalStorageSettingsStore } from './SettingsStore'
import { LocalStorageTextStore } from './TextStore'
import { DEFAULT_SETTINGS } from './types'

// Minimal localStorage for Node.
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
}

beforeEach(() => mem.clear())

describe('localStorage stores', () => {
  it('library keeps many passages and a current one', async () => {
    const s = new LocalStorageTextStore()
    expect(await s.list()).toEqual([])
    await s.save({ id: 'a', title: 'A', text: 'Hi.', createdAt: '2026-10-12', sentenceCount: 1 })
    await s.save({ id: 'b', title: 'B', text: 'Yo.', createdAt: '2026-10-13' })
    expect((await s.list()).map((p) => p.id)).toEqual(['b', 'a'])
    expect((await s.list())[1]).not.toHaveProperty('text')
    expect((await s.get('a'))?.text).toBe('Hi.')
    await s.setCurrent('a')
    expect(await s.currentId()).toBe('a')
    await s.remove('a')
    expect(await s.get('a')).toBeNull()
    expect(await s.currentId()).toBeNull()
    expect((await s.list()).map((p) => p.id)).toEqual(['b'])
  })
  it('settings merge with defaults', async () => {
    const s = new LocalStorageSettingsStore()
    expect(await s.load()).toEqual(DEFAULT_SETTINGS)
    mem.set('sr.settings', JSON.stringify({ speed: 0.8 }))
    expect(await s.load()).toEqual({ ...DEFAULT_SETTINGS, speed: 0.8 })
  })
  it('progress is per passage and stamps the time', async () => {
    const s = new LocalStorageProgressStore()
    await s.save({ passageId: 'a', sentenceIndex: 4, mode: 'flow' })
    await s.save({ passageId: 'b', sentenceIndex: 9, mode: 'echo' })
    expect((await s.load('a'))?.sentenceIndex).toBe(4)
    expect((await s.load('a'))?.updatedAt).toBeTruthy()
    expect((await s.listAll()).length).toBe(2)
    await s.remove('a')
    expect(await s.load('a')).toBeNull()
  })
  it('sessions list newest first and upsert replaces', async () => {
    const s = new LocalStorageSessionLogStore()
    const base = { passageId: 'a', passageTitle: 'T', mode: 'flow' as const, minutes: 1, backTaps: 0, forwardTaps: 0, restarts: 0, endedAt: '' }
    await s.upsert({ ...base, id: '1', startedAt: '2026-10-01' })
    await s.upsert({ ...base, id: '2', startedAt: '2026-10-02' })
    await s.upsert({ ...base, id: '1', startedAt: '2026-10-01', minutes: 5 })
    const list = await s.list()
    expect(list.map((l) => l.id)).toEqual(['2', '1'])
    expect(list[1].minutes).toBe(5)
  })
})
