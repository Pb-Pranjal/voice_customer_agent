import {
  LayoutDashboard, Mic, Search, RotateCcw, UserCheck,
  History, Settings, Headphones, ChevronRight
} from 'lucide-react'

const NAV = [
  { id: 'overview',    label: 'Overview',          icon: LayoutDashboard },
  { id: 'voice',       label: 'Voice Assistant',   icon: Mic },
  { id: 'orders',      label: 'Order Lookup',       icon: Search },
  { id: 'refund',      label: 'Refund Requests',    icon: RotateCcw },
  { id: 'escalation',  label: 'Human Escalation',   icon: UserCheck },
  { id: 'history',     label: 'Conversation History', icon: History },
  { id: 'settings',    label: 'Settings',           icon: Settings },
]

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside style={{
      width: 240, minHeight: '100vh', background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Headphones size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Maya</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Support Agent</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px' }}>
        {NAV.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                marginBottom: 2, transition: 'all 0.15s', textAlign: 'left',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>{label}</span>
              {isActive && <ChevronRight size={14} />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Azure AI Foundry</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Voice Live API</div>
      </div>
    </aside>
  )
}
