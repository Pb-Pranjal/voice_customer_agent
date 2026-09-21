import { useState } from 'react'
import { Search, Package, Loader } from 'lucide-react'
import Card from '../components/Card'
import StatusBadge from '../components/StatusBadge'
import { apiUrl } from '../config'

export default function OrderLookup() {
  const [orderId, setOrderId] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const lookup = async (e) => {
    e.preventDefault()
    const id = orderId.trim()
    if (!id) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(apiUrl(`/api/orders/${encodeURIComponent(id)}`))
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Order not found.')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Order Lookup</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Enter an order ID to check its status and delivery details.</p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <form onSubmit={lookup} style={{ display: 'flex', gap: 10 }}>
          <input
            value={orderId}
            onChange={e => setOrderId(e.target.value)}
            placeholder="e.g. A1001"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 8,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: '#fff', fontSize: 14,
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading || !orderId.trim() ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {loading ? <Loader size={14} className="animate-spin-slow" /> : <Search size={14} />}
            Search
          </button>
        </form>
      </Card>

      {error && (
        <Card style={{ borderColor: 'var(--error)44', background: '#3a1a1a' }}>
          <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p>
        </Card>
      )}

      {result && (
        <Card className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--accent-glow)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Package size={18} color="var(--accent-light)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{result.item}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Order #{result.order_id}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <StatusBadge status={result.status} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Carrier', value: result.carrier || 'Not assigned' },
              { label: 'Estimated Delivery', value: result.estimated_delivery },
              { label: 'Total Amount', value: `₹${result.total_inr?.toLocaleString('en-IN')}` },
              { label: 'Status', value: result.status },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '12px 14px', borderRadius: 8,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {result.refund_status && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund Request</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text-secondary)' }}>Status: </span><strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{result.refund_status}</strong></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Ticket: </span><strong style={{ color: 'var(--text-primary)' }}>{result.refund_ticket_id}</strong></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Reason: </span><strong style={{ color: 'var(--text-primary)' }}>{result.refund_reason}</strong></div>
                <div><span style={{ color: 'var(--text-secondary)' }}>Amount: </span><strong style={{ color: 'var(--text-primary)' }}>₹{result.refund_amount_inr?.toLocaleString('en-IN')}</strong></div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
