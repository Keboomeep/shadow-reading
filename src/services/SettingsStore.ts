import { DEFAULT_SETTINGS, type Settings } from './types'

export interface SettingsStore {
  load(): Promise<Settings>
  save(settings: Settings): Promise<void>
}

const KEY = 'sr.settings'

export class LocalStorageSettingsStore implements SettingsStore {
  async load(): Promise<Settings> {
    const raw = localStorage.getItem(KEY)
    // Merge so new settings added later get their default.
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS
  }
  async save(settings: Settings): Promise<void> {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }
}
