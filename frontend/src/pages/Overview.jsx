import { Mic, Search, RotateCcw, UserCheck, Zap } from 'lucide-react'
import Card from '../components/Card'

const STATS = [
  { label: 'Voice Sessions', value: '—', icon: Mic, color: 'var(--accent)' },
  { label: 'Orders Looked Up', value: '—', icon: Search, color: 'var(--info)' },
  { label: 'Refunds Processed', value: '—', icon: RotateCcw, color: 'var(--success)' },
  { label: 'Escalations', value: '—', icon: UserCheck, color: 'var(--warning)' },
]

const QUICK = [
  { id: 'voice',      label: 'Start Voice Session', desc: 'Talk to Maya in real time', icon: Mic },
  { id: 'orders',     label: 'Look Up an Order',    desc: 'Check status and delivery',  icon: Search },
  { id: 'refund',     label: 'Request a Refund',    desc: 'Submit a refund request',    icon: RotateCcw },
  { id: 'escalation', label: 'Escalate to Human',   desc: 'Connect with a live agent',  icon: UserCheck },
]

export default function Overview({ onNavigate }) {
  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Welcome to Maya — your AI-powered customer support agent.
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {STATS.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
              </div>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color={color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {QUICK.map(({ id, label, desc, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '18px 20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.background = 'var(--bg-hover)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg-card)'
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--accent-glow)', border: '1px solid var(--accent)44',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon size={18} color="var(--accent-light)" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Demo orders note */}
      <Card style={{ marginTop: 8, borderColor: 'var(--accent)33' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Demo orders available: </span>
          Try order IDs <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1001</code>,{' '}
          <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1002</code>, or{' '}
          <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1003</code> in Order Lookup, Refund, or via voice.
        </div>
      </Card>
    </div>
  )
}
