import { History, Bot, User } from 'lucide-react'
import Card from '../components/Card'

export default function ConversationHistory({ transcript }) {
  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Conversation History</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Messages from the current voice session.</p>
      </div>

      {transcript.length === 0 ? (
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0', color: 'var(--text-muted)' }}>
            <History size={32} />
            <p style={{ fontSize: 14 }}>No conversation yet. Start a voice session to see messages here.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {transcript.map((msg, i) => (
            <Card key={msg.id} style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: msg.role === 'user' ? 'var(--bg-hover)' : 'var(--accent-glow)',
                border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'var(--accent)44'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'user'
                  ? <User size={13} color="var(--text-secondary)" />
                  : <Bot size={13} color="var(--accent-light)" />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {msg.role === 'user' ? 'You' : 'Maya'} · #{i + 1}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.55 }}>{msg.text}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
