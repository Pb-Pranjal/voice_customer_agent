import { useState } from 'react'
import { RotateCcw, AlertTriangle, CheckCircle, Loader } from 'lucide-react'
import Card from '../components/Card'

const REASONS = [
  'Item arrived damaged',
  'Wrong item delivered',
  'Item not as described',
  'Changed my mind',
  'Duplicate order',
  'Other',
]

export default function RefundRequest() {
  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!orderId.trim() || !reason) return
    setConfirming(true)
  }

  const confirmRefund = async () => {
    setConfirming(false)
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId.trim(), reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Refund request failed.')
      setResult(data)
      setOrderId('')
      setReason('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 8,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  }

  return (
    <div style={{ padding: 32, maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Refund Request</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Submit a refund for an eligible order. Refunds take up to 5 business days.
          <br />
          <span style={{ color: 'var(--warning)', fontSize: 12 }}>Note: This uses demo data — no real refund is processed.</span>
        </p>
      </div>

      {/* Confirmation modal */}
      {confirming && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <Card style={{ maxWidth: 380, width: '90%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Confirm Refund Request</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Submit refund for order <strong style={{ color: 'var(--text-primary)' }}>{orderId.toUpperCase()}</strong>?<br />
                  Reason: <em>{reason}</em>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirming(false)} style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
              <button onClick={confirmRefund} style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Confirm</button>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Order ID</label>
            <input
              value={orderId}
              onChange={e => setOrderId(e.target.value)}
              placeholder="e.g. A1001"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Reason for Refund</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            >
              <option value="">Select a reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading || !orderId.trim() || !reason}
            style={{
              padding: '11px 0', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: 'pointer',
              opacity: loading || !orderId.trim() || !reason ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? <Loader size={14} className="animate-spin-slow" /> : <RotateCcw size={14} />}
            Submit Refund Request
          </button>
        </form>
      </Card>

      {error && (
        <Card style={{ marginTop: 16, borderColor: 'var(--error)44', background: '#3a1a1a' }}>
          <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p>
        </Card>
      )}

      {result && (
        <Card style={{ marginTop: 16, borderColor: 'var(--success)44' }} className="animate-fade-in">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <CheckCircle size={18} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--success)', marginBottom: 8 }}>Refund Request Submitted</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
                <span>Ticket: <strong style={{ color: 'var(--text-primary)' }}>{result.ticket_id}</strong></span>
                <span>Amount: <strong style={{ color: 'var(--text-primary)' }}>₹{result.refund_amount_inr?.toLocaleString('en-IN')}</strong></span>
                <span>Processing time: <strong style={{ color: 'var(--text-primary)' }}>{result.processing_days} business days</strong></span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
