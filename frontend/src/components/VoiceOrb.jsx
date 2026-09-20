import { STATES } from '../hooks/useVoice'

const STATE_CONFIG = {
  [STATES.IDLE]:       { color: '#484f58', label: 'Idle',       pulse: false },
  [STATES.CONNECTING]: { color: '#d29922', label: 'Connecting…', pulse: true },
  [STATES.REQUESTING_MIC]: { color: '#d29922', label: 'Requesting microphone…', pulse: true },
  [STATES.LISTENING]:  { color: '#3fb950', label: 'Listening',  pulse: true },
  [STATES.USER_SPEAKING]: { color: '#3fb950', label: 'User speaking', pulse: true },
  [STATES.THINKING]:   { color: '#58a6ff', label: 'Thinking…',  pulse: true },
  [STATES.SPEAKING]:   { color: '#7c6af7', label: 'Speaking',   pulse: true },
  [STATES.ERROR]:      { color: '#f85149', label: 'Error',      pulse: false },
}

export default function VoiceOrb({ state }) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG[STATES.IDLE]
  const bars = 12

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Orb */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {/* Pulse rings */}
        {cfg.pulse && [0, 1].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `2px solid ${cfg.color}`,
            animation: `pulse-ring 1.8s ease-out ${i * 0.6}s infinite`,
          }} />
        ))}
        {/* Core orb */}
        <div style={{
          position: 'absolute', inset: 16, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 35%, ${cfg.color}55, ${cfg.color}22)`,
          border: `2px solid ${cfg.color}88`,
          boxShadow: `0 0 30px ${cfg.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.4s ease',
        }}>
          {/* Waveform bars inside orb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {Array.from({ length: bars }).map((_, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                background: cfg.color,
                height: state === STATES.SPEAKING
                  ? `${8 + Math.sin(i * 0.8) * 14}px`
                  : state === STATES.LISTENING
                  ? `${6 + Math.sin(i * 1.2) * 8}px`
                  : '4px',
                animation: (state === STATES.SPEAKING || state === STATES.LISTENING)
                  ? `wave 0.8s ease-in-out ${i * 0.07}s infinite alternate`
                  : 'none',
                transition: 'height 0.3s ease',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* State label */}
      <div style={{
        fontSize: 13, fontWeight: 500,
        color: cfg.color,
        letterSpacing: '0.05em', textTransform: 'uppercase',
        transition: 'color 0.3s',
      }}>
        {cfg.label}
      </div>
    </div>
  )
}
