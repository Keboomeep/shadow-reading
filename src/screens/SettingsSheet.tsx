import type { Highlight, Settings } from '../services'
import { TakeRecorder } from '../player/recorder'
import { tts } from '../tts'
import { OPENAI_VOICES } from '../tts/OpenAITTS'

type Props = {
  settings: Settings
  onChange: (s: Settings) => void
  onClose: () => void
  onRestart: () => void
}

const HIGHLIGHTS: Highlight[] = ['none', 'sentence', 'word', 'range']

/** The rare settings. Frequent ones (speed, loop, echo pause) live in the bottom bar. */
export default function SettingsSheet({ settings, onChange, onClose, onRestart }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })
  const voices = tts.voices()

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />

        <div className="row">
          <span>Voice</span>
          <div className="seg">
            <button className={settings.voiceProvider === 'device' ? 'on' : ''} onClick={() => set('voiceProvider', 'device')}>Phone</button>
            <button className={settings.voiceProvider === 'openai' ? 'on' : ''} disabled={!tts.canUse('openai')} onClick={() => set('voiceProvider', 'openai')}>OpenAI</button>
          </div>
        </div>

        {settings.voiceProvider === 'openai' ? (
          <label className="row">
            <span>OpenAI voice <span className="dim small">made once per sentence, then free</span></span>
            <select value={settings.openaiVoice ?? 'nova'} onChange={(e) => set('openaiVoice', e.target.value)}>
              {OPENAI_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        ) : (
          <label className="row">
            <span>Phone voice <span className="dim small">{tts.currentVoice()?.name ?? 'loading…'}</span></span>
            <select value={settings.voiceName ?? ''} onChange={(e) => { const v = e.target.value || undefined; tts.setVoice(v); set('voiceName', v) }}>
              <option value="">Auto (best English voice)</option>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          </label>
        )}

        <div className="row">
          <span>Highlight in Flow</span>
          <div className="seg">
            {HIGHLIGHTS.map((h) => (
              <button key={h} className={settings.highlightFlow === h ? 'on' : ''} onClick={() => set('highlightFlow', h)}>{h}</button>
            ))}
          </div>
        </div>

        <div className="row">
          <span>Highlight in Echo</span>
          <div className="seg">
            {HIGHLIGHTS.map((h) => (
              <button key={h} className={settings.highlightEcho === h ? 'on' : ''} onClick={() => set('highlightEcho', h)}>{h}</button>
            ))}
          </div>
        </div>

        <label className="row toggle">
          <span>Auto Echo <span className="dim small">next sentence without a tap</span></span>
          <input type="checkbox" checked={settings.autoEcho} onChange={(e) => set('autoEcho', e.target.checked)} />
        </label>

        <label className="row toggle">
          <span>Record my take {!TakeRecorder.available() && <span className="dim small">(needs https + mic)</span>}</span>
          <input type="checkbox" disabled={!TakeRecorder.available()} checked={settings.recordTake} onChange={(e) => set('recordTake', e.target.checked)} />
        </label>

        <div className="row actions">
          <button onClick={() => { onRestart(); onClose() }}>Restart from top</button>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}
