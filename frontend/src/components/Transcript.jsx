import { useEffect, useRef } from 'react'
import { Bot, User } from 'lucide-react'

export default function Transcript({ messages }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24,
      }}>
        Start a conversation — Maya will greet you automatically.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.map(msg => (
        <div
          key={msg.id}
          className="animate-fade-in"
          style={{
            display: 'flex', gap: 10,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: msg.role === 'user' ? 'var(--bg-hover)' : 'var(--accent-glow)',
            border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'var(--accent)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {msg.role === 'user'
              ? <User size={14} color="var(--text-secondary)" />
              : <Bot size={14} color="var(--accent-light)" />}
          </div>

          {/* Bubble */}
          <div style={{
            maxWidth: '72%', padding: '10px 14px', borderRadius: 12,
            background: msg.role === 'user' ? 'var(--bg-hover)' : 'var(--bg-card)',
            border: `1px solid ${msg.role === 'user' ? 'var(--border)' : 'var(--accent)33'}`,
            fontSize: 14, lineHeight: 1.55, color: 'var(--text-primary)',
            borderTopRightRadius: msg.role === 'user' ? 4 : 12,
            borderTopLeftRadius: msg.role === 'assistant' ? 4 : 12,
          }}>
            {msg.text}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
