import type { SpeakResult, TTSProvider, VoiceInfo, WordEvent } from './TTSProvider'

/**
 * OpenAI voice through the Supabase "tts" function.
 *
 * The app never holds the OpenAI key. It asks the function for a link to the
 * audio of one sentence; the function makes it once and keeps it. The app
 * tries the stored link first, so a sentence heard before never waits.
 *
 * No word timing comes back, so the word highlight runs on the estimate.
 * Speed is applied at playback, which keeps pitch on modern browsers.
 */

export const OPENAI_VOICES = ['nova', 'shimmer', 'coral', 'sage', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'onyx', 'verse'] as const
const MODEL = 'gpt-4o-mini-tts'
const BUCKET = 'tts'

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class OpenAITTS implements TTSProvider {
  private audio: HTMLAudioElement | null = null
  private resolveCurrent: ((r: SpeakResult) => void) | null = null
  private listeners = new Set<(e: WordEvent) => void>()
  private voice: string = 'nova'
  /** Sentence text -> audio URL. Also holds in-flight requests so prefetch and speak share one call. */
  private urls = new Map<string, Promise<string>>()
  lastError = ''

  private supabaseUrl: string
  private anonKey: string
  constructor(supabaseUrl: string, anonKey: string) {
    this.supabaseUrl = supabaseUrl
    this.anonKey = anonKey
  }

  async init(): Promise<void> { /* nothing to load */ }

  voices(): VoiceInfo[] {
    return OPENAI_VOICES.map((name) => ({ name, lang: 'en' }))
  }
  setVoice(name: string | undefined) {
    if (name && (OPENAI_VOICES as readonly string[]).includes(name)) this.voice = name
  }
  currentVoice(): VoiceInfo | null {
    return { name: this.voice, lang: 'en' }
  }
  onWordBoundary(cb: (e: WordEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Call inside a tap: iPhone only lets audio start from a tap, once per element. */
  prime() {
    const a = this.element()
    try {
      a.muted = true
      void a.play().then(() => { a.pause(); a.muted = false }).catch(() => { a.muted = false })
    } catch { a.muted = false }
  }

  private element(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio()
      this.audio.preload = 'auto'
      ;(this.audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    }
    return this.audio
  }

  /** Where the audio for this sentence lives, making it if needed. */
  private urlFor(text: string): Promise<string> {
    const k = `${this.voice}|${text}`
    const existing = this.urls.get(k)
    if (existing) return existing
    const p = (async () => {
      const key = await sha256(`${MODEL}|${this.voice}|${text}`)
      const direct = `${this.supabaseUrl}/storage/v1/object/public/${BUCKET}/${this.voice}/${key}.mp3`
      // Fast path: already made.
      try { if ((await fetch(direct, { method: 'HEAD' })).ok) return direct } catch { /* fall through */ }
      const r = await fetch(`${this.supabaseUrl}/functions/v1/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}` },
        body: JSON.stringify({ text, voice: this.voice }),
      })
      const body = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!r.ok || !body.url) throw new Error(body.error ?? `tts ${r.status}`)
      return body.url
    })()
    this.urls.set(k, p)
    p.catch(() => this.urls.delete(k))
    return p
  }

  /** Start making the audio for a sentence before it is needed. */
  prefetch(text: string) {
    void this.urlFor(text).catch(() => {})
  }

  stop() {
    const resolve = this.resolveCurrent
    this.resolveCurrent = null
    const a = this.audio
    if (a) { a.pause(); a.onended = a.onerror = null }
    resolve?.('stopped')
  }

  async speak(text: string, rate: number): Promise<SpeakResult> {
    this.stop()
    let url: string
    try {
      url = await this.urlFor(text)
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e)
      return 'error'
    }
    if (this.resolveCurrent) return 'stopped' // a newer speak() started while we fetched
    const a = this.element()
    return new Promise<SpeakResult>((resolve) => {
      this.resolveCurrent = resolve
      const finish = (r: SpeakResult) => {
        if (this.resolveCurrent !== resolve) return
        this.resolveCurrent = null
        a.onended = a.onerror = null
        resolve(r)
      }
      a.onended = () => finish('ended')
      a.onerror = () => { this.lastError = 'audio error'; finish('error') }
      a.src = url
      a.playbackRate = rate
      a.muted = false
      a.play().catch((e) => { this.lastError = 'play: ' + (e instanceof Error ? e.name : String(e)); finish('error') })
    })
  }
}
