import { useState } from 'react'
import { UserCheck, Clock, Ticket, Loader } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'

export default function HumanEscalation() {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    if (!summary.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summary.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Escalation failed.')
      setResult(data)
      setSummary('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Human Escalation</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Request to speak with a live support agent. Describe your issue briefly.
        </p>
      </div>

      {!result ? (
        <Card>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Issue Summary
              </label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                placeholder="Briefly describe your issue so the agent can help you faster…"
                rows={4}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !summary.trim()}
              style={{
                padding: '11px 0', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: loading || !summary.trim() ? 'not-allowed' : 'pointer',
                opacity: loading || !summary.trim() ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? <Loader size={14} className="animate-spin-slow" /> : <UserCheck size={14} />}
              Request Human Agent
            </button>
          </form>
          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#3a1a1a', border: '1px solid var(--error)44' }}>
              <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ borderColor: 'var(--accent)44' }} className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserCheck size={20} color="var(--accent-light)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>Agent Requested</div>
              <StatusBadge status="queued" />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <Ticket size={15} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TICKET ID</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{result.ticket_id}</div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <Clock size={15} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ESTIMATED WAIT</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>~{result.wait_minutes} minutes</div>
              </div>
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
              {result.message}
            </div>
          </div>

          <button
            onClick={() => setResult(null)}
            style={{
              marginTop: 16, width: '100%', padding: '9px 0', borderRadius: 8,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
            }}
          >
            Submit Another Request
          </button>
        </Card>
      )}
    </div>
  )
}
