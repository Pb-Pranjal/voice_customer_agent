import { Mic, MicOff, PhoneOff, Zap, AlertCircle } from 'lucide-react'
import { STATES } from '../hooks/useVoice'
import VoiceOrb from '../components/VoiceOrb'
import Transcript from '../components/Transcript'
import Card from '../components/Card'

export default function VoiceAssistant({ voiceState, transcript, error, toolEvents, connect, disconnect, interrupt }) {
  const isActive = voiceState !== STATES.IDLE && voiceState !== STATES.ERROR
  const isSpeaking = voiceState === STATES.SPEAKING

  return (
    <div style={{ padding: 32, display: 'flex', gap: 24, height: '100%', maxHeight: 'calc(100vh - 64px)' }}>
      {/* Left — orb + controls */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, padding: 32 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }}>Maya</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>AI Support Agent</p>
          </div>

          <VoiceOrb state={voiceState} />

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px',
              background: '#3a1a1a', border: '1px solid var(--error)44', borderRadius: 8,
              fontSize: 12, color: 'var(--error)', lineHeight: 1.5, width: '100%',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Main button */}
          {!isActive ? (
            <button
              onClick={connect}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, var(--accent), #a78bfa)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 20px var(--accent-glow)', transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Mic size={16} /> Start Session
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              {isSpeaking && (
                <button
                  onClick={interrupt}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10,
                    border: '1px solid var(--accent)', background: 'var(--accent-glow)',
                    color: 'var(--accent-light)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Zap size={14} /> Interrupt
                </button>
              )}
              <button
                onClick={disconnect}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  border: '1px solid var(--error)66', background: '#3a1a1a',
                  color: 'var(--error)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <PhoneOff size={14} /> End Session
              </button>
            </div>
          )}
        </Card>

        {/* Tool events */}
        {toolEvents.length > 0 && (
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Tool Calls
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {[...toolEvents].reverse().map(ev => (
                <div key={ev.id} style={{
                  padding: '8px 10px', borderRadius: 6,
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  fontSize: 11,
                }}>
                  <div style={{ color: 'var(--accent-light)', fontWeight: 600, marginBottom: 2 }}>{ev.name}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {ev.result?.found === false || ev.result?.success === false
                      ? <span style={{ color: 'var(--error)' }}>{ev.result.message}</span>
                      : <span style={{ color: 'var(--success)' }}>Success</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Right — transcript */}
      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <MicOff size={14} color="var(--text-secondary)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conversation</span>
          {isActive && (
            <span style={{
              marginLeft: 'auto', fontSize: 11, color: 'var(--success)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
              Live
            </span>
          )}
        </div>
        <Transcript messages={transcript} />
      </Card>
    </div>
  )
}
