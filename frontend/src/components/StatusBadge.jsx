const COLORS = {
  shipped:    { bg: '#1f3a2a', color: '#3fb950', border: '#2ea04326' },
  delivered:  { bg: '#1a2f4a', color: '#58a6ff', border: '#388bfd26' },
  processing: { bg: '#2d2a1a', color: '#d29922', border: '#d2992226' },
  error:      { bg: '#3a1a1a', color: '#f85149', border: '#f8514926' },
  success:    { bg: '#1f3a2a', color: '#3fb950', border: '#2ea04326' },
  queued:     { bg: '#2a1f3a', color: '#a78bfa', border: '#a78bfa26' },
  default:    { bg: 'var(--bg-hover)', color: 'var(--text-secondary)', border: 'var(--border)' },
}

export default function StatusBadge({ status }) {
  const key = status?.toLowerCase()
  const c = COLORS[key] || COLORS.default
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      textTransform: 'capitalize',
    }}>
      {status}
    </span>
  )
}
