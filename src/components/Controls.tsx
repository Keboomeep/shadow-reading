import { useEffect, useState } from 'react'
import type { Loop } from '../services'
import type { Phase } from '../player/usePlayer'
import type { RecorderInfo } from '../player/recorder'
import { WORDS_PER_SECOND } from '../tts/wordTimeline'

const LOOPS: Loop[] = ['off', 'sentence', 'paragraph', 'all']
const LOOP_LABEL: Record<Loop, string> = { off: 'off', sentence: 'sentence', paragraph: 'paragraph', all: 'all' }
/** The speed choices from the Figma annotation, plus 1.0. */
const SPEEDS = [1.5, 1.2, 1.0, 0.8, 0.6]

type FlowProps = {
  playing: boolean
  speed: number
  loop: Loop
  onBack: () => void
  onPlayPause: () => void
  onForward: () => void
  onSpeed: (speed: number) => void
  onLoop: (loop: Loop) => void
}

/**
 * Flow mode bottom bar: speed, back one sentence, play, forward one sentence, loop.
 * The voice works sentence by sentence, so back and forward move one sentence, not seconds.
 */
export function FlowBar(p: FlowProps) {
  const [showSpeed, setShowSpeed] = useState(false)
  const nextLoop = LOOPS[(LOOPS.indexOf(p.loop) + 1) % LOOPS.length]
  return (
    <div className="transport" style={{ position: 'relative' }}>
      <button className="round small" onClick={() => setShowSpeed((v) => !v)} aria-label="Speed">{p.speed.toFixed(1)}x</button>
      {showSpeed && (
        <div className="speed-pop" role="menu">
          {SPEEDS.map((s) => (
            <button key={s} className={Math.abs(s - p.speed) < 0.01 ? 'on' : ''} onClick={() => { p.onSpeed(s); setShowSpeed(false) }}>{s.toFixed(1)}x</button>
          ))}
        </div>
      )}
      <button className="round" onClick={p.onBack} aria-label="Back one sentence">
        <span className="arc"><img src="/icons/arc-back.svg" alt="" /></span>
      </button>
      <button className="play" onClick={p.onPlayPause} aria-label={p.playing ? 'Pause' : 'Play'}>
        {p.playing ? '❚❚' : '▶'}
      </button>
      <button className="round" onClick={p.onForward} aria-label="Forward one sentence">
        <span className="arc"><img src="/icons/arc-fwd.svg" alt="" /></span>
      </button>
      <button className={p.loop === 'off' ? 'round loop' : 'round loop on'} onClick={() => p.onLoop(nextLoop)} aria-label={`Loop ${LOOP_LABEL[p.loop]}`}>↺</button>
    </div>
  )
}

type EchoProps = {
  phase: Phase
  playing: boolean
  recording: boolean
  hasTake: boolean
  /** False when the mic is blocked: plain http on the phone, or permission refused. */
  micOk: boolean
  /** The "Record my take" setting. Off means the speak stage is a plain pause. */
  recordOn: boolean
  takeInfo: RecorderInfo
  wordCount: number
  speed: number
  onListen: () => void
  onSpeak: () => void
  onStop: () => void
  onRedo: () => void
  onCompare: () => void
  onPlay: () => void
  onPause: () => void
}

const CAPTION: Record<Phase, string> = {
  idle: 'Tap the headphones to start',
  speaking: 'Listening to the audio',
  pausing: 'Say the sentence and then hit “Stop”',
  playback: 'Listen to and compare with your voice',
}

/** Echo mode bottom bar: three stages. Listen fills with color as the voice reads. */
export function EchoBar(p: EchoProps) {
  const [progress, setProgress] = useState(0)

  // The listen pill fills as the voice goes, on an estimate of the sentence length.
  useEffect(() => {
    if (p.phase !== 'speaking') return
    const start = performance.now()
    const total = (p.wordCount / (WORDS_PER_SECOND * p.speed)) * 1000
    const id = setInterval(() => setProgress(Math.min(1, (performance.now() - start) / total)), 100)
    return () => clearInterval(id)
  }, [p.phase, p.wordCount, p.speed])

  const listenOn = p.phase === 'speaking'
  const speakOn = p.phase === 'pausing'
  const compareOn = p.phase === 'playback'
  const idle = p.phase === 'idle'
  // Full once listening is over, empty before it starts.
  const fill = listenOn ? progress : idle ? 0 : 1

  return (
    <>
      <div className="caption">
        {speakOn && !p.recording
          ? (!p.recordOn ? 'Recording is off. Turn on “Record my take” in settings' : p.micOk ? 'Say the sentence and then hit “Stop”' : 'No mic here. Say it, then hit “Stop” (mic needs https)')
          : idle && p.takeInfo.error
            ? `Stopped: ${p.takeInfo.error}`
            : compareOn && p.takeInfo.bytes
              ? (p.takeInfo.error ? `Your take: ${p.takeInfo.error}` : `Your take, ${p.takeInfo.seconds}s`)
              : CAPTION[p.phase]}
      </div>
      <div className="stages">
        {/* Idle: play. While the voice reads: pause. In the other stages: hear the sentence again. */}
        <button className={`stage ${listenOn || idle ? 'wide' : ''}`} onClick={idle ? p.onPlay : listenOn ? p.onPause : p.onListen} aria-label={idle ? 'Play' : listenOn ? 'Pause' : 'Listen again'}>
          <span className="fill" style={{ width: `${fill * 100}%` }} />
          <img src={listenOn && progress > 0.25 ? '/icons/headphones-echo.svg' : '/icons/headphones-light.svg'} alt="" />
        </button>

        {speakOn ? (
          <div className="stage wide speaking">
            <img className="wave" src="/icons/waveform.svg" alt="" />
            <button className="ctl" onClick={p.onStop} aria-label="Stop"><span className="square" /></button>
            <button className="ctl" onClick={p.onRedo} aria-label="Record again">↺</button>
          </div>
        ) : (
          <button className={`stage ${idle ? '' : 'wide'}`} onClick={p.onSpeak} aria-label="Speak this sentence">
            <img src="/icons/mouth-light.svg" alt="" />
          </button>
        )}

        <button className={`stage ${compareOn ? 'wide on' : ''}`} onClick={p.onCompare} disabled={!p.hasTake} aria-label="Hear your take">
          <img src={compareOn ? '/icons/ear-dark.svg' : '/icons/ear-light.svg'} alt="" />
        </button>
      </div>
    </>
  )
}
