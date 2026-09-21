import { useEffect, useState } from 'react'
import { Mic, Search, RotateCcw, UserCheck, Zap, Loader, AlertTriangle } from 'lucide-react'
import Card from '../components/Card'
import { apiUrl } from '../config'

const QUICK = [
  { id: 'voice', label: 'Start Voice Session', desc: 'Talk to Maya in real time', icon: Mic },
  { id: 'orders', label: 'Look Up an Order', desc: 'Check status and delivery', icon: Search },
  { id: 'refund', label: 'Request a Refund', desc: 'Submit a refund request', icon: RotateCcw },
  { id: 'escalation', label: 'Escalate to Human', desc: 'Connect with a live agent', icon: UserCheck },
]

const currency = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

export default function Overview({ onNavigate }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadSummary = async () => {
    try {
      const response = await fetch(apiUrl('/api/dashboard/summary'))
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Could not load dashboard summary.')
      setError(null)
      setSummary(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const refreshSummary = () => {
    setLoading(true)
    void loadSummary()
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void loadSummary()
    }, 0)
    const onRefresh = refreshSummary
    window.addEventListener('dashboard:refresh', onRefresh)
    return () => {
      window.clearTimeout(initialLoad)
      window.removeEventListener('dashboard:refresh', onRefresh)
    }
  }, [])

  const stats = [
    { label: 'Total Orders', value: summary ? summary.total_orders : '—', icon: Search, color: 'var(--info)' },
    { label: 'Total Refund Requests', value: summary ? summary.total_refund_requests : '—', icon: RotateCcw, color: 'var(--warning)' },
    { label: 'Pending Refund Requests', value: summary ? summary.pending_refund_requests : '—', icon: AlertTriangle, color: 'var(--accent)' },
    { label: 'Total Refund Amount', value: summary ? currency(summary.total_refund_amount) : '—', icon: UserCheck, color: 'var(--success)' },
  ]

  const recentRefunds = summary?.recent_refunds || []
  const recentComplaints = summary?.recent_complaints || []

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Zap size={20} color="var(--accent)" />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Dashboard</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Welcome to Maya — your AI-powered customer support agent.
        </p>
      </div>

      {error && (
        <Card style={{ marginBottom: 20, borderColor: 'var(--error)44', background: '#3a1a1a' }}>
          <p style={{ margin: 0, color: 'var(--error)', fontSize: 13 }}>{error}</p>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{loading && !summary ? '…' : value}</div>
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

      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Recent Refund Requests</h2>
          <button
            type="button"
            onClick={refreshSummary}
            disabled={loading}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading ? <Loader size={14} className="animate-spin-slow" /> : <RotateCcw size={14} />}
            Refresh
          </button>
        </div>

        {loading && !summary && (
          <Card>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Loader size={14} className="animate-spin-slow" /> Loading dashboard...
            </div>
          </Card>
        )}

        {!loading && !error && recentRefunds.length === 0 && (
          <Card>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No refund requests yet.</p>
          </Card>
        )}

        {!loading && recentRefunds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentRefunds.map((refund) => (
              <Card key={refund.ticket_id || `${refund.order_id}-${refund.requested_at}`} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{refund.item || 'Unknown Item'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3 }}>Order #{refund.order_id}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', textTransform: 'capitalize' }}>{refund.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Ticket: <strong style={{ color: 'var(--text-primary)' }}>{refund.ticket_id}</strong></span>
                  <span>Amount: <strong style={{ color: 'var(--text-primary)' }}>{currency(refund.refund_amount_inr)}</strong></span>
                  <span>Reason: <strong style={{ color: 'var(--text-primary)' }}>{refund.reason}</strong></span>
                  <span>Status: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{refund.status}</strong></span>
                  <span>Issued: <strong style={{ color: 'var(--text-primary)' }}>{refund.refund_issued_date ? new Date(refund.refund_issued_date).toLocaleDateString() : 'Not available'}</strong></span>
                  <span>Expected: <strong style={{ color: 'var(--text-primary)' }}>{refund.expected_refund_date || 'Not available'}</strong></span>
                  <span>Remaining: <strong style={{ color: 'var(--text-primary)' }}>{refund.remaining_working_days ?? 0} working days</strong></span>
                  <span>Complaint: <strong style={{ color: 'var(--text-primary)' }}>{refund.complaint_ticket_id || '—'}</strong></span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Recent Complaints</h2>
        {recentComplaints.length === 0 && (
          <Card>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>No complaint tickets generated.</p>
          </Card>
        )}
        {recentComplaints.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentComplaints.map((complaint) => (
              <Card key={complaint.complaint_ticket_id} style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>Complaint: <strong style={{ color: 'var(--text-primary)' }}>{complaint.complaint_ticket_id}</strong></span>
                  <span>Refund Ticket: <strong style={{ color: 'var(--text-primary)' }}>{complaint.refund_ticket_id}</strong></span>
                  <span>Order: <strong style={{ color: 'var(--text-primary)' }}>{complaint.order_id}</strong></span>
                  <span>Amount: <strong style={{ color: 'var(--text-primary)' }}>{currency(complaint.refund_amount_inr)}</strong></span>
                  <span>Reason: <strong style={{ color: 'var(--text-primary)' }}>{complaint.reason}</strong></span>
                  <span>Status: <strong style={{ color: 'var(--text-primary)' }}>{complaint.complaint_status}</strong></span>
                  <span style={{ gridColumn: '1 / -1' }}>Created: <strong style={{ color: 'var(--text-primary)' }}>{complaint.created_date ? new Date(complaint.created_date).toLocaleString() : 'Not available'}</strong></span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card style={{ marginTop: 24, borderColor: 'var(--accent)33' }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Demo orders available: </span>
          Try order IDs <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1001</code>,{' '}
          <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1003</code>, or{' '}
          <code style={{ background: 'var(--bg-hover)', padding: '1px 6px', borderRadius: 4, color: 'var(--text-primary)' }}>A1002</code> in Order Lookup, Refund, or via voice.
        </div>
      </Card>
    </div>
  )
}
