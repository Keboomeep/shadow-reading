/**
 * The voice. The app only talks to this interface.
 * Today: Web Speech API (built into the phone). Later: ElevenLabs through the backend.
 */

export type SpeakResult = 'ended' | 'stopped' | 'error'

export type WordEvent = {
  /** Index of the word inside the sentence, starting at 0. */
  wordIndex: number
  /** performance.now() when the word started. */
  at: number
}

export type VoiceInfo = { name: string; lang: string }

export interface TTSProvider {
  /** Wait for voices to load. Safe to call more than once. */
  init(): Promise<void>
  /**
   * Speak one sentence. The promise is the "sentence end" event:
   * it resolves 'ended' when the voice finished, 'stopped' if stop() was called.
   */
  speak(text: string, rate: number): Promise<SpeakResult>
  /** Stop right now. Any running speak() resolves 'stopped'. */
  stop(): void
  /** Word boundary events for the sentence being spoken. Returns an unsubscribe function. */
  onWordBoundary(cb: (e: WordEvent) => void): () => void
  voices(): VoiceInfo[]
  setVoice(name: string | undefined): void
  currentVoice(): VoiceInfo | null
}
