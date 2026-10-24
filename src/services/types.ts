export type Mode = 'flow' | 'echo'
export type Highlight = 'none' | 'sentence' | 'word' | 'range'
export type Loop = 'off' | 'sentence' | 'paragraph' | 'all'
/** Books come from EPUB files. Everything else (paste, .md, .txt) is an article. */
export type Kind = 'book' | 'article'

/** The text she is reading. Sentences are derived from `text` when loaded. */
export type Passage = {
  id: string
  title: string
  /** Plain text. Paragraphs separated by newlines. Markdown already stripped. */
  text: string
  createdAt: string
  /** From markdown headings or the EPUB table of contents. Empty for pasted text. */
  chapters?: Chapter[]
  /** Counted at import. Lets the home page show progress without loading the text. */
  sentenceCount?: number
  kind?: Kind
  author?: string
  /** Small cover image as a data URL (about 200×300 JPEG). Books only. */
  cover?: string
  /** Library folder name. Empty means no folder. */
  folder?: string
}

/** A passage without its text. What the home page lists. */
export type PassageSummary = Omit<Passage, 'text'>

export type Chapter = { title: string; paragraph: number }

export type Settings = {
  /** Highlight style per mode. Flow follows the voice word by word; Echo shows the whole sentence. */
  highlightFlow: Highlight
  highlightEcho: Highlight
  /** 0.5 to 1.5 in 0.05 steps */
  speed: number
  /** Echo pause = words × this. 0.2 to 0.8 */
  secondsPerWord: number
  autoEcho: boolean
  recordTake: boolean
  loop: Loop
  /** Phone voice, or OpenAI through the backend. */
  voiceProvider: 'device' | 'openai'
  /** Device voice name (Samantha...) or OpenAI voice (nova, shimmer...). Kept per provider. */
  voiceName?: string
  openaiVoice?: string
}

export const DEFAULT_SETTINGS: Settings = {
  highlightFlow: 'word',
  highlightEcho: 'sentence',
  speed: 1,
  secondsPerWord: 0.5,
  autoEcho: true,
  recordTake: true,
  loop: 'off',
  voiceProvider: 'device',
  openaiVoice: 'nova',
}

/** Where she stopped in a passage. */
export type Progress = {
  passageId: string
  sentenceIndex: number
  mode: Mode
  updatedAt?: string
}

export type SessionLog = {
  id: string
  passageId: string
  passageTitle: string
  startedAt: string
  endedAt: string
  mode: Mode | 'mixed'
  minutes: number
  backTaps: number
  forwardTaps: number
  restarts: number
}
