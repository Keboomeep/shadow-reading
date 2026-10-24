import { useCallback, useEffect, useRef, useState } from 'react'
import { EchoBar, FlowBar } from '../components/Controls'
import PassageView from '../components/PassageView'
import SettingsSheet from './SettingsSheet'
import ChaptersSheet from './ChaptersSheet'
import { usePlayer } from '../player/usePlayer'
import { useWordPosition } from '../player/useWordPosition'
import { useSessionLogger } from '../player/useSessionLogger'
import type { Sentence } from '../text/splitSentences'
import { services, type Mode, type Passage, type Settings } from '../services'
import { tts } from '../tts'

type Props = {
  passage: Passage
  sentences: Sentence[]
  settings: Settings
  onSettings: (s: Settings) => void
  startIndex: number
  startMode: Mode
  onBack: () => void
}

/** Bars hide this long after Play, and this long after a reveal while playing. */
const HIDE_AFTER_PLAY = 1200
const HIDE_AFTER_REVEAL = 4000

export default function ReaderScreen({ passage, sentences, settings, onSettings, startIndex, startMode, onBack }: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [showChapters, setShowChapters] = useState(false)
  const chapters = passage.chapters ?? []

  const logger = useSessionLogger(passage)
  const player = usePlayer({ sentences, settings, initialIndex: startIndex, initialMode: startMode, onEvent: logger.onEvent })
  logger.update(player.index, player.mode)

  // Full screen while playing in Flow. Echo keeps its bar, the stages live there.
  const [hidden, setHidden] = useState(false)
  const chrome = !(player.playing && hidden && player.mode === 'flow')
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideLater = useCallback((ms: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setHidden(true), ms)
  }, [])
  useEffect(() => {
    if (player.playing) hideLater(HIDE_AFTER_PLAY)
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [player.playing, hideLater])
  const play = () => { setHidden(false); player.play() }
  const reveal = useCallback(() => {
    setHidden(false)
    if (player.playing) hideLater(HIDE_AFTER_REVEAL)
  }, [player.playing, hideLater])

  const highlight = player.mode === 'flow' ? settings.highlightFlow : settings.highlightEcho
  const wordCount = sentences[player.index]?.words.length ?? 0
  const pos = useWordPosition(player.phase, player.index, wordCount, settings.speed, highlight)

  // Pick the voice provider, load voices, then apply the one she picked.
  useEffect(() => {
    tts.use(settings.voiceProvider)
    void tts.init().then(() => tts.setVoice(settings.voiceProvider === 'openai' ? settings.openaiVoice : settings.voiceName))
  }, [settings.voiceProvider, settings.voiceName, settings.openaiVoice])

  // Save the place on every sentence change.
  useEffect(() => {
    void services.progress.save({ passageId: passage.id, sentenceIndex: player.index, mode: player.mode })
  }, [passage.id, player.index, player.mode])

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onSettings({ ...settings, [k]: v })

  return (
    <div className={`${chrome ? 'screen' : 'screen immersive'} mode-${player.mode}`}>
      <header className="topbar">
        <button className="ghost round" onClick={onBack} aria-label="Home">‹</button>
        <div className="modes">
          <button className={player.mode === 'flow' ? 'on' : ''} onClick={() => player.switchMode('flow')} aria-label="Flow mode">
            <img src={player.mode === 'flow' ? '/icons/headphones-dark.svg' : '/icons/headphones-light.svg'} alt="" />
          </button>
          <button className={player.mode === 'echo' ? 'on' : ''} onClick={() => player.switchMode('echo')} aria-label="Echo mode">
            <img src={player.mode === 'echo' ? '/icons/mouth-dark.svg' : '/icons/mouth-light.svg'} alt="" />
          </button>
        </div>
        <button className="ghost round" onClick={() => setShowSettings(true)} aria-label="Settings"><img className="icon" src="/icons/gear.svg" alt="" width={14} height={14} /></button>
      </header>

      <main className={`reader phase-${player.phase}`}>
        <button className="titlebar ghost" onClick={() => chapters.length && setShowChapters(true)} disabled={!chapters.length}>
          <span className="ellipsis">{passage.title}{chapters.length > 0 && <span className="dim"> ▾</span>}</span>
        </button>
        <PassageView
          sentences={sentences}
          chapters={chapters}
          current={player.index}
          highlight={highlight}
          wordIndex={pos.wordIndex}
          rangeStart={pos.rangeStart}
          onPick={player.pick}
          immersive={!chrome}
          onReveal={reveal}
        />
      </main>

      <footer className="bottombar reader-bar">
        {player.mode === 'flow' ? (
          <FlowBar
            playing={player.playing}
            speed={settings.speed}
            loop={settings.loop}
            onBack={player.back}
            onPlayPause={player.playing ? player.pause : play}
            onForward={player.forward}
            onSpeed={(v) => set('speed', v)}
            onLoop={(v) => set('loop', v)}
          />
        ) : (
          <EchoBar
            phase={player.phase}
            playing={player.playing}
            recording={player.recording}
            hasTake={player.hasTake}
            micOk={player.micOk}
            recordOn={settings.recordTake}
            takeInfo={player.takeInfo}
            wordCount={wordCount}
            speed={settings.speed}
            onPlay={play}
            onPause={player.pause}
            onListen={player.repeat}
            onSpeak={player.speakNow}
            onStop={player.stopSpeaking}
            onRedo={player.redoSpeaking}
            onCompare={() => void player.replayTake()}
          />
        )}
      </footer>

      {showSettings && (
        <SettingsSheet settings={settings} onChange={onSettings} onClose={() => setShowSettings(false)} onRestart={player.restart} />
      )}
      {showChapters && (
        <ChaptersSheet chapters={chapters} sentences={sentences} current={player.index} onPick={player.pick} onClose={() => setShowChapters(false)} />
      )}
    </div>
  )
}
