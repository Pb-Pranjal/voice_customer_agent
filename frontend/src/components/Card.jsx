export default function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 24,
      ...style,
    }}>
      {children}
    </div>
  )
}
