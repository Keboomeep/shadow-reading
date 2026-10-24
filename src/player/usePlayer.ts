import { useCallback, useEffect, useRef, useState } from 'react'
import type { Sentence } from '../text/splitSentences'
import type { Mode, Settings } from '../services'
import { tts } from '../tts'
import { nextIndex } from './nextIndex'
import { recorder, TakeRecorder, type RecorderInfo } from './recorder'

export type PlayerEvent = 'play' | 'pause' | 'back' | 'forward' | 'repeat' | 'restart' | 'pick' | 'end'
/** idle, or the three Echo stages: speaking = listen, pausing = speak, playback = compare. */
export type Phase = 'idle' | 'speaking' | 'pausing' | 'playback'

type Options = {
  sentences: Sentence[]
  settings: Settings
  initialIndex: number
  initialMode: Mode
  onEvent?: (e: PlayerEvent) => void
}

type SpeakResult = 'stop' | 'redo' | 'timeout'

/** Pause after a sentence in echo mode, when nothing is recorded. */
export function echoPauseMs(wordCount: number, secondsPerWord: number): number {
  return Math.max(1500, Math.round(wordCount * secondsPerWord * 1000))
}

/** The speak stage waits for Stop. This is only a safety net if she walks away. */
export const SPEAK_LIMIT_MS = 120_000

/**
 * Drives the voice. One sentence at a time.
 * Every run has a token. When the user taps something, the token changes and
 * the old run quietly gives up, so stale callbacks can never move the player.
 */
export function usePlayer({ sentences, settings, initialIndex, initialMode, onEvent }: Options) {
  const [index, setIndex] = useState(initialIndex)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [recording, setRecording] = useState(false)
  const [hasTake, setHasTake] = useState(false)
  /** False when the mic cannot be used here (plain http, or permission refused). */
  const [micOk, setMicOk] = useState(TakeRecorder.available())
  /** What the recorder did last, for the caption. */
  const [takeInfo, setTakeInfo] = useState<RecorderInfo>({ bytes: 0, seconds: 0, peak: 0, error: '' })

  // Live values the async loop reads without re-creating itself.
  const live = useRef({ sentences, settings, mode, index })
  useEffect(() => { live.current = { sentences, settings, mode, index } }, [sentences, settings, mode, index])
  const runId = useRef(0)
  // The Speak stage waits here until Stop, Redo, or the time limit.
  const speakWait = useRef<((r: SpeakResult) => void) | null>(null)
  const emit = useCallback((e: PlayerEvent) => onEvent?.(e), [onEvent])

  const waitForSpeak = (ms: number) =>
    new Promise<SpeakResult>((resolve) => {
      const t = setTimeout(() => { speakWait.current = null; resolve('timeout') }, ms)
      speakWait.current = (r) => { clearTimeout(t); speakWait.current = null; resolve(r) }
    })

  const stop = useCallback(() => {
    runId.current++
    tts.stop()
    recorder.cancel()
    speakWait.current?.('stop')
    setPlaying(false)
    setPhase('idle')
    setRecording(false)
  }, [])

  /**
   * Run from sentence `start`. In Echo mode each sentence goes through
   * listen, speak (record), compare (play the take). `from` can skip straight to speak.
   */
  const runFrom = useCallback(async (start: number, from: 'listen' | 'speak' = 'listen') => {
    const token = ++runId.current
    let i = start
    let stage = from
    setPlaying(true)
    while (token === runId.current) {
      const { sentences, settings, mode } = live.current
      const s = sentences[i]
      if (!s) break
      setIndex(i)

      if (stage === 'listen') {
        setPhase('speaking')
        // Make the next sentence ready while this one plays (OpenAI only).
        const upcoming = nextIndex(sentences, i, settings.loop)
        if (upcoming !== null && sentences[upcoming]) tts.prefetch(sentences[upcoming].text)
        const result = await tts.speak(s.text, settings.speed)
        if (token !== runId.current) return
        if (result !== 'ended') break
      }
      stage = 'listen'

      if (mode === 'echo') {
        recorder.clearTake()
        setHasTake(false)
        let result: SpeakResult
        const canRecord = live.current.settings.recordTake && TakeRecorder.available()
        do {
          setPhase('pausing')
          const rec = canRecord && (await recorder.start())
          if (token !== runId.current) return
          setRecording(!!rec)
          setMicOk(!!rec || !live.current.settings.recordTake)
          // Her rule: the speak stage ends only when she hits Stop.
          result = await waitForSpeak(SPEAK_LIMIT_MS)
          if (token !== runId.current) return
          if (rec) {
            if (result === 'redo') recorder.cancel()
            else setHasTake(await recorder.stopRecording())
          }
          setTakeInfo({ ...recorder.info })
          setRecording(false)
        } while (result === 'redo')

        if (recorder.hasTake()) {
          setPhase('playback')
          await recorder.playTake()
          setTakeInfo({ ...recorder.info })
          if (token !== runId.current) return
          if (/^play:/.test(recorder.info.error)) break // playback failed: stop here so the caption can say why
        } else if (canRecord) {
          break // the mic was expected but nothing came back: stop and show the reason
        }
        if (!live.current.settings.autoEcho) break
      }

      const next = nextIndex(sentences, i, live.current.settings.loop)
      if (next === null) { emit('end'); break }
      i = next
    }
    if (token === runId.current) { setPlaying(false); setPhase('idle'); setRecording(false) }
  }, [emit])

  const play = useCallback(() => {
    emit('play')
    tts.prime()
    // Ask for the mic inside the tap, which iOS wants, so the speak stage can record later.
    if (live.current.mode === 'echo' && live.current.settings.recordTake && TakeRecorder.available()) {
      void recorder.warmUp().then((ok) => setMicOk(ok))
    }
    void runFrom(live.current.index)
  }, [runFrom, emit])
  const pause = useCallback(() => { emit('pause'); stop() }, [stop, emit])

  /**
   * Move to `i`. If playing, the voice restarts there right away.
   * In echo mode a tap always speaks the sentence it lands on: one tap, one listen.
   */
  const goTo = useCallback((i: number, wasPlaying = playing || live.current.mode === 'echo') => {
    const n = live.current.sentences.length
    const clamped = Math.max(0, Math.min(n - 1, i))
    if (wasPlaying) void runFrom(clamped)
    else { runId.current++; setIndex(clamped) }
  }, [runFrom, playing])

  const back = useCallback(() => { emit('back'); goTo(live.current.index - 1) }, [goTo, emit])
  const forward = useCallback(() => { emit('forward'); goTo(live.current.index + 1) }, [goTo, emit])
  const repeat = useCallback(() => { emit('repeat'); goTo(live.current.index, true) }, [goTo, emit])
  const restart = useCallback(() => { emit('restart'); goTo(0, true) }, [goTo, emit])
  const pick = useCallback((i: number) => { emit('pick'); goTo(i) }, [goTo, emit])

  // Echo stage controls
  /** Done speaking. Ends the speak stage now. Called inside her tap, so playback is allowed after. */
  const stopSpeaking = useCallback(() => { recorder.primePlayback(); speakWait.current?.('stop') }, [])
  /** Throw the take away and record again. */
  const redoSpeaking = useCallback(() => speakWait.current?.('redo'), [])
  /** Skip the listen stage and record this sentence now. */
  const speakNow = useCallback(() => void runFrom(live.current.index, 'speak'), [runFrom])
  /** Hear the last take again, outside the loop. */
  const replayTake = useCallback(async () => {
    if (!recorder.hasTake()) return
    runId.current++
    tts.stop()
    setPlaying(false)
    setPhase('playback')
    recorder.primePlayback()
    await recorder.playTake()
    setTakeInfo({ ...recorder.info })
    setPhase('idle')
  }, [])

  const switchMode = useCallback((m: Mode) => {
    setMode(m)
    live.current.mode = m
    // Keep the place. If playing, restart the current sentence under the new mode.
    if (playing) void runFrom(live.current.index)
  }, [playing, runFrom])

  // Speed change while playing: restart the current sentence at the new rate.
  const lastSpeed = useRef(settings.speed)
  useEffect(() => {
    if (lastSpeed.current !== settings.speed) {
      lastSpeed.current = settings.speed
      if (playing) void runFrom(live.current.index)
    }
  }, [settings.speed, playing, runFrom])

  // Stop the voice when the screen goes away.
  useEffect(() => () => { runId.current++; tts.stop(); recorder.cancel() }, [])

  return {
    index, mode, playing, phase, recording, hasTake, micOk, takeInfo,
    play, pause, back, forward, repeat, restart, pick, switchMode,
    stopSpeaking, redoSpeaking, speakNow, replayTake,
  }
}
