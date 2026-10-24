import type { SessionLog } from '../services'

type Props = { logs: SessionLog[]; onBack: () => void }

export default function SessionsScreen({ logs, onBack }: Props) {
  return (
    <div className="screen">
      <header className="topbar">
        <button className="ghost" onClick={onBack}>‹ Back</button>
        <h1>Sessions</h1>
        <span />
      </header>
      <main className="content">
        {logs.length === 0 ? (
          <p className="dim">No sessions yet. Play something and come back.</p>
        ) : (
          <table className="sessions">
            <thead>
              <tr><th>Date</th><th>Mode</th><th>Min</th><th>Back</th><th>Fwd</th><th>Restart</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
                  <td>{l.mode}</td>
                  <td>{l.minutes}</td>
                  <td>{l.backTaps}</td>
                  <td>{l.forwardTaps}</td>
                  <td>{l.restarts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
