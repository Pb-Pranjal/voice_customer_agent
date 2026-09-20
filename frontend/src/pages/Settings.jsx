import { Settings as SettingsIcon, Server, Info } from 'lucide-react'
import Card from '../components/Card'

const DEMO_ORDERS = [
  { id: 'A1001', item: 'Wireless Headphones', status: 'Shipped', total: '₹2,499' },
  { id: 'A1002', item: 'Laptop Stand',        status: 'Processing', total: '₹1,299' },
  { id: 'A1003', item: 'USB-C Cable',         status: 'Delivered', total: '₹349' },
]

export default function SettingsPage() {
  return (
    <div style={{ padding: 32, maxWidth: 640 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Configuration reference for this deployment.</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Server size={16} color="var(--accent-light)" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Backend Connection</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'API Base URL', value: 'http://localhost:8000' },
            { label: 'Voice WebSocket', value: 'ws://localhost:8000/ws/voice' },
            { label: 'Azure Credentials', value: 'Configured via server .env (not exposed to browser)' },
          ].map(({ label, value }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: 'var(--bg-surface)',
              borderRadius: 8, border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Info size={16} color="var(--info)" />
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Demo Order Data</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          The backend uses in-memory demo orders. Use these IDs to test all features.
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['Order ID', 'Item', 'Status', 'Total'].map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '8px 10px', fontSize: 11,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--border)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEMO_ORDERS.map(o => (
              <tr key={o.id}>
                {[o.id, o.item, o.status, o.total].map((v, i) => (
                  <td key={i} style={{
                    padding: '10px 10px', color: i === 0 ? 'var(--accent-light)' : 'var(--text-primary)',
                    fontFamily: i === 0 ? 'monospace' : 'inherit',
                    borderBottom: '1px solid var(--border)',
                  }}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
