import type { SpeakResult, TTSProvider, VoiceInfo, WordEvent } from './TTSProvider'

/**
 * Placeholder voice using the browser's speechSynthesis.
 *
 * iOS Safari quirks handled here:
 * - Voices load late. init() waits for `voiceschanged` (up to 1.5 s).
 * - Speech only starts after a user tap. The Play button is that tap.
 * - cancel() then speak() right away can fail silently. We wait 40 ms between them.
 * - An utterance can be garbage collected before `end` fires. We keep a reference.
 * - `boundary` events may not fire at all on iOS. Callers must cope without them.
 */

// Most natural English voices first. Names are matched as "contains".
const PREFERRED = [
  'Samantha', 'Ava', 'Allison', 'Zoe', 'Nicky', 'Joelle', 'Evan', 'Tom',
  'Karen', 'Daniel', 'Moira', 'Serena', 'Tessa',
  'Google US English', 'Google UK English Female', 'Microsoft Aria', 'Microsoft Jenny',
]

// Apple novelty voices. Fun once, useless for practice.
const NOVELTY = /^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Junior|Kathy|Organ|Pipe Organ|Ralph|Trinoids|Whisper|Zarvox|Wobble|Superstar|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Fred)\b/

function rank(name: string): number {
  const i = PREFERRED.findIndex((p) => name.includes(p))
  return i === -1 ? PREFERRED.length : i
}

function wordStarts(text: string): number[] {
  const starts: number[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) starts.push(m.index)
  return starts
}

export class WebSpeechTTS implements TTSProvider {
  private get synth(): SpeechSynthesis { return window.speechSynthesis }
  private voice: SpeechSynthesisVoice | null = null
  private wanted: string | undefined
  private current: SpeechSynthesisUtterance | null = null
  private resolveCurrent: ((r: SpeakResult) => void) | null = null
  private listeners = new Set<(e: WordEvent) => void>()

  async init(): Promise<void> {
    if (this.synth.getVoices().length === 0) {
      await new Promise<void>((resolve) => {
        const done = () => { this.synth.removeEventListener('voiceschanged', done); resolve() }
        this.synth.addEventListener('voiceschanged', done)
        setTimeout(done, 1500)
      })
    }
    this.pickVoice()
  }

  private pickVoice() {
    const all = this.synth.getVoices()
    const english = all.filter((v) => v.lang.toLowerCase().startsWith('en'))
    let pick: SpeechSynthesisVoice | undefined
    if (this.wanted) pick = all.find((v) => v.name === this.wanted)
    if (!pick) {
      for (const name of PREFERRED) {
        // Prefer the "enhanced" or "premium" version of a voice when the phone has it.
        const matches = english.filter((v) => v.name.includes(name))
        pick = matches.find((v) => /enhanced|premium/i.test(v.name)) ?? matches[0]
        if (pick) break
      }
    }
    if (!pick) pick = english.find((v) => v.lang === 'en-US') ?? english[0]
    this.voice = pick ?? null
  }

  voices(): VoiceInfo[] {
    return this.synth
      .getVoices()
      .filter((v) => v.lang.toLowerCase().startsWith('en') && !NOVELTY.test(v.name))
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
      .map((v) => ({ name: v.name, lang: v.lang }))
  }

  setVoice(name: string | undefined) {
    this.wanted = name
    this.pickVoice()
  }

  currentVoice(): VoiceInfo | null {
    return this.voice ? { name: this.voice.name, lang: this.voice.lang } : null
  }

  onWordBoundary(cb: (e: WordEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  stop() {
    const resolve = this.resolveCurrent
    this.resolveCurrent = null
    this.current = null
    this.synth.cancel()
    resolve?.('stopped')
  }

  speak(text: string, rate: number): Promise<SpeakResult> {
    this.stop()
    if (!this.voice) this.pickVoice()

    return new Promise<SpeakResult>((resolve) => {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = this.voice?.lang ?? 'en-US'
      if (this.voice) u.voice = this.voice
      u.rate = rate
      const starts = wordStarts(text)

      const finish = (r: SpeakResult) => {
        if (this.current !== u) return // already replaced or stopped
        this.current = null
        this.resolveCurrent = null
        resolve(r)
      }

      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return
        // Which word does this charIndex belong to?
        let w = 0
        while (w + 1 < starts.length && starts[w + 1] <= e.charIndex) w++
        const ev: WordEvent = { wordIndex: w, at: performance.now() }
        this.listeners.forEach((cb) => cb(ev))
      }
      u.onend = () => { clearTimeout(watchdog); finish('ended') }

      // Watchdog: Safari sometimes never fires `end`. Once the voice has clearly
      // stopped and we are still waiting, treat it as ended. Never cuts a voice
      // that is still speaking.
      const expectedMs = (text.length * 90) / rate + 3000
      const check = () => {
        if (this.current !== u) return
        if (this.synth.speaking || this.synth.pending) { watchdog = setTimeout(check, 1000); return }
        finish('ended')
      }
      let watchdog = setTimeout(check, expectedMs)
      u.onerror = (e) => { clearTimeout(watchdog); finish(e.error === 'interrupted' || e.error === 'canceled' ? 'stopped' : 'error') }

      this.current = u
      this.resolveCurrent = resolve
      // Small gap after cancel() so iOS actually starts the new utterance.
      setTimeout(() => {
        if (this.current === u) this.synth.speak(u)
      }, 40)
    })
  }
}
