import type { TTSProvider, VoiceInfo, SpeakResult, WordEvent } from './TTSProvider'
import { WebSpeechTTS } from './WebSpeechTTS'
import { OpenAITTS } from './OpenAITTS'

export type VoiceProvider = 'device' | 'openai'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** The one place that picks the voice. Switches between the phone voice and OpenAI at runtime. */
class SwitchingTTS implements TTSProvider {
  private device = new WebSpeechTTS()
  private openai = supabaseUrl && anonKey ? new OpenAITTS(supabaseUrl, anonKey) : null
  private current: TTSProvider = this.device
  provider: VoiceProvider = 'device'

  /** OpenAI is only possible when Supabase is configured. */
  canUse(p: VoiceProvider): boolean { return p === 'device' || !!this.openai }

  use(p: VoiceProvider) {
    const next = p === 'openai' && this.openai ? this.openai : this.device
    if (next !== this.current) { this.current.stop(); this.current = next }
    this.provider = next === this.device ? 'device' : 'openai'
  }

  init() { return this.current.init() }
  speak(text: string, rate: number): Promise<SpeakResult> { return this.current.speak(text, rate) }
  stop() { this.current.stop() }
  onWordBoundary(cb: (e: WordEvent) => void) {
    const a = this.device.onWordBoundary(cb)
    const b = this.openai?.onWordBoundary(cb)
    return () => { a(); b?.() }
  }
  voices(): VoiceInfo[] { return this.current.voices() }
  setVoice(name: string | undefined) { this.current.setVoice(name) }
  currentVoice() { return this.current.currentVoice() }
  /** Make the next sentence ready. Only OpenAI needs it. */
  prefetch(text: string) { if (this.current === this.openai) this.openai?.prefetch(text) }
  /** Inside a tap, so iPhone allows playback later. */
  prime() { this.openai?.prime() }
  lastError(): string { return this.current === this.openai ? (this.openai?.lastError ?? '') : '' }
}

export const tts = new SwitchingTTS()
export type { TTSProvider, SpeakResult, WordEvent, VoiceInfo } from './TTSProvider'
