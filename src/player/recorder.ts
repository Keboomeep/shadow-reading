/**
 * Records her take during the echo speak stage and plays it straight back.
 * Audio stays in memory. Nothing is uploaded or saved.
 *
 * Why not MediaRecorder: on iPhone it often returns an empty file. So this
 * records raw samples through the Web Audio engine and writes a WAV itself.
 *
 * iPhone rules this code works around:
 * - The mic needs a secure page (https) and a permission tap.
 * - The audio engine and audio playback may only start inside a tap.
 *   warmUp() runs in the Play tap, primePlayback() in the Stop tap.
 * - The mic stream can end on its own. start() gets a fresh one when needed.
 */

/** A tiny silent WAV. Playing it inside a tap unlocks the audio element on iPhone. */
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

export type RecorderInfo = { bytes: number; seconds: number; peak: number; error: string }

type AudioContextCtor = typeof AudioContext
/** Looked up when needed, so this file also loads outside a browser (tests). */
function audioContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

/** 16-bit mono WAV from float samples. */
function toWav(chunks: Float32Array[], sampleRate: number): Blob {
  const length = chunks.reduce((n, c) => n + c.length, 0)
  const buffer = new ArrayBuffer(44 + length * 2)
  const v = new DataView(buffer)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + length * 2, true); str(8, 'WAVE')
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, length * 2, true)
  let o = 44
  for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, c[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

export class TakeRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private sink: GainNode | null = null
  private chunks: Float32Array[] = []
  private peak = 0
  private audio: HTMLAudioElement | null = null
  private lastTake: Blob | null = null
  /** What happened last, for the caption. */
  info: RecorderInfo = { bytes: 0, seconds: 0, peak: 0, error: '' }

  static available(): boolean {
    return !!audioContextCtor() && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext
  }

  private async getStream(): Promise<MediaStream> {
    const live = this.stream?.getAudioTracks().some((t) => t.readyState === 'live')
    if (!live) this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    return this.stream!
  }

  private async getContext(): Promise<AudioContext> {
    const Ctx = audioContextCtor()
    if (!this.ctx && Ctx) this.ctx = new Ctx()
    if (this.ctx && this.ctx.state !== 'running') { try { await this.ctx.resume() } catch { /* needs a tap, try again later */ } }
    return this.ctx!
  }

  /** Ask for the mic and wake the audio engine. Call inside a tap. */
  async warmUp(): Promise<boolean> {
    if (!TakeRecorder.available()) return false
    try {
      await this.getStream()
      await this.getContext()
      return true
    } catch (e) {
      this.info = { bytes: 0, seconds: 0, peak: 0, error: 'mic: ' + (e instanceof Error ? e.name : String(e)) }
      return false
    }
  }

  /** Make playback possible a moment later. Call inside a tap. */
  primePlayback() {
    void this.getContext()
    if (!this.audio) this.audio = new Audio()
    const a = this.audio
    try {
      a.src = SILENCE
      a.muted = true
      void a.play().then(() => { a.pause(); a.muted = false }).catch(() => { a.muted = false })
    } catch {
      a.muted = false
    }
  }

  /** Start recording. Resolves false if the mic is refused or the engine will not start. */
  async start(): Promise<boolean> {
    try {
      const stream = await this.getStream()
      const ctx = await this.getContext()
      this.cleanupNodes()
      this.chunks = []
      this.peak = 0
      this.source = ctx.createMediaStreamSource(stream)
      this.processor = ctx.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0)
        for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > this.peak) this.peak = a }
        this.chunks.push(new Float32Array(data))
      }
      // The processor only runs when connected to the output. The gain of 0 keeps her mic silent.
      this.sink = ctx.createGain()
      this.sink.gain.value = 0
      this.source.connect(this.processor)
      this.processor.connect(this.sink)
      this.sink.connect(ctx.destination)
      this.info = { bytes: 0, seconds: 0, peak: 0, error: '' }
      return true
    } catch (e) {
      this.cleanupNodes()
      this.info = { bytes: 0, seconds: 0, peak: 0, error: 'record: ' + (e instanceof Error ? e.name : String(e)) }
      return false
    }
  }

  /** Stop recording and keep the take. Resolves true if something was recorded. */
  async stopRecording(): Promise<boolean> {
    const rate = this.ctx?.sampleRate ?? 44100
    const chunks = this.chunks
    const peak = this.peak
    this.cleanupNodes()
    const samples = chunks.reduce((n, c) => n + c.length, 0)
    const seconds = Math.round((samples / rate) * 10) / 10
    const muted = this.stream?.getAudioTracks().some((t) => t.muted) ?? false
    if (samples === 0) {
      this.info = { bytes: 0, seconds: 0, peak: 0, error: `nothing recorded (engine ${this.ctx?.state ?? 'none'}${muted ? ', mic muted' : ''})` }
      return false
    }
    const blob = toWav(chunks, rate)
    this.lastTake = blob
    this.info = { bytes: blob.size, seconds, peak, error: peak < 0.002 ? `recorded ${seconds}s of silence${muted ? ' (mic muted)' : ''}` : '' }
    return true
  }

  hasTake(): boolean {
    return !!this.lastTake
  }

  /** Play the last take. Resolves when playback ends or fails. */
  async playTake(): Promise<void> {
    const blob = this.lastTake
    if (!blob || blob.size === 0) return
    if (!this.audio) this.audio = new Audio()
    const a = this.audio
    const url = URL.createObjectURL(blob)
    await new Promise<void>((resolve) => {
      const done = () => { URL.revokeObjectURL(url); a.onended = a.onerror = null; resolve() }
      a.onended = done
      a.onerror = () => { this.info = { ...this.info, error: 'play: media error' }; done() }
      a.muted = false
      a.src = url
      a.play().catch((e) => { this.info = { ...this.info, error: 'play: ' + (e instanceof Error ? e.name : String(e)) }; done() })
    })
  }

  /** Stop anything in progress without playing. */
  cancel() {
    this.cleanupNodes()
    if (this.audio) { this.audio.pause(); this.audio.onended = this.audio.onerror = null }
  }

  /** Forget the last take, for a new sentence. */
  clearTake() {
    this.lastTake = null
  }

  private cleanupNodes() {
    try { this.processor?.disconnect() } catch { /* already gone */ }
    try { this.source?.disconnect() } catch { /* already gone */ }
    try { this.sink?.disconnect() } catch { /* already gone */ }
    if (this.processor) this.processor.onaudioprocess = null
    this.processor = null
    this.source = null
    this.sink = null
  }
}

export const recorder = new TakeRecorder()
