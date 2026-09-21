import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_BASE_URL } from '../config'

export const STATES = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  REQUESTING_MIC: 'requesting_mic',
  LISTENING: 'listening',
  USER_SPEAKING: 'user_speaking',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  ERROR: 'error',
}

export function useVoice() {
  const [voiceState, setVoiceState] = useState(STATES.IDLE)
  const [transcript, setTranscript] = useState([])
  const [error, setError] = useState(null)
  const [toolEvents, setToolEvents] = useState([])

  const wsRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const playQueueRef = useRef([])
  const isPlayingRef = useRef(false)
  const activeRef = useRef(false)
  const audioStatsRef = useRef({ chunks: 0, samples: 0 })

  const addMessage = useCallback((role, text) => {
    if (!text?.trim()) return
    setTranscript(prev => [...prev, { role, text, id: Date.now() + Math.random() }])
  }, [])

  const drainQueue = useCallback(function drainQueue() {
    const ctx = audioCtxRef.current
    if (!ctx || playQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }
    isPlayingRef.current = true
    const buf = playQueueRef.current.shift()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.onended = drainQueue
    src.start()
  }, [])

  const playPCM16 = useCallback((base64) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      const raw = atob(base64)
      const buf = new Int16Array(raw.length / 2)
      for (let i = 0; i < buf.length; i++) {
        buf[i] = raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8)
      }
      const audioBuf = ctx.createBuffer(1, buf.length, 24000)
      const ch = audioBuf.getChannelData(0)
      for (let i = 0; i < buf.length; i++) ch[i] = buf[i] / 32768
      playQueueRef.current.push(audioBuf)
      if (!isPlayingRef.current) drainQueue()
    } catch (err) {
      console.error('[voice] Audio playback failed', err)
    }
  }, [drainQueue])

  const clearPlayback = useCallback(() => {
    playQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  const stopMic = useCallback(() => {
    sourceRef.current?.disconnect()
    processorRef.current?.disconnect()
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    processorRef.current = null
    streamRef.current = null
    audioCtxRef.current = null
  }, [])

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'session.updated':
        setVoiceState(STATES.LISTENING)
        break
      case 'input_audio_buffer.speech_started':
        clearPlayback()
        setVoiceState(STATES.USER_SPEAKING)
        console.info('[voice] Azure detected speech')
        break
      case 'input_audio_buffer.speech_stopped':
        setVoiceState(STATES.THINKING)
        console.info('[voice] Azure detected end of speech')
        break
      case 'response.created':
        setVoiceState(STATES.THINKING)
        break
      case 'response.audio.delta':
        setVoiceState(STATES.SPEAKING)
        if (event.delta) playPCM16(event.delta)
        break
      case 'response.audio_transcript.done':
      case 'response.audio_transcript.delta':
        if (event.transcript) addMessage('assistant', event.transcript)
        setVoiceState(STATES.LISTENING)
        break
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript) addMessage('user', event.transcript)
        break
      case 'tool_call':
        setToolEvents(prev => [...prev, { ...event, id: Date.now() }])
        if (event.name === 'start_refund' && event.result?.success) {
          window.dispatchEvent(new CustomEvent('dashboard:refresh'))
        }
        break
      case 'response.done':
        setVoiceState(STATES.LISTENING)
        break
      case 'error':
        setError(event.error?.message || event.message || 'Azure Voice Live returned an unknown error.')
        setVoiceState(STATES.ERROR)
        break
      default:
        break
    }
  }, [addMessage, clearPlayback, playPCM16])

  const connect = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true
    setError(null)
    setVoiceState(STATES.CONNECTING)

    const ws = new WebSocket(`${WS_BASE_URL}/ws/voice`)
    wsRef.current = ws

    ws.onopen = async () => {
      try {
        console.info('[voice] WebSocket open', ws.url)
        setVoiceState(STATES.REQUESTING_MIC)
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('This browser does not support microphone capture.')
        }
        const ctx = new AudioContext({ sampleRate: 24000 })
        audioCtxRef.current = ctx
        await ctx.resume()
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const track = stream.getAudioTracks()[0]
        const settings = track?.getSettings() || {}
        console.info('[voice] Microphone granted', {
          deviceId: settings.deviceId ? `${settings.deviceId.slice(0, 6)}…` : 'unknown',
          label: track?.label || 'unknown',
          channelCount: settings.channelCount,
          sampleRate: settings.sampleRate,
          enabled: track?.enabled,
          readyState: track?.readyState,
        })
        if (!track || !track.enabled || track.readyState !== 'live') {
          throw new Error('The selected microphone is not live or enabled.')
        }
        await ctx.audioWorklet.addModule('/pcm-processor.js')
        console.info('[voice] AudioContext ready', {
          sampleRate: ctx.sampleRate,
          state: ctx.state,
          channelCount: settings.channelCount || 1,
        })
        const source = ctx.createMediaStreamSource(stream)
        sourceRef.current = source
        const processor = new AudioWorkletNode(ctx, 'pcm-processor')
        processorRef.current = processor
        processor.onprocessorerror = (event) => {
          console.error('[voice] AudioWorklet processor error', event)
          setError('Microphone audio processing failed. Check the browser console.')
          setVoiceState(STATES.ERROR)
        }
        processor.port.onmessage = (e) => {
          let audioBase64 = e.data
          if (e.data && typeof e.data === 'object') {
            if (e.data.type !== 'pcm') {
              console.debug('[voice] AudioWorklet status', e.data)
              return
            }
            const bytes = new Uint8Array(e.data.buffer)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i])
            }
            audioBase64 = btoa(binary)
          }
          if (ws.readyState !== WebSocket.OPEN) return
          if (typeof audioBase64 !== 'string' || audioBase64.length === 0) return
          const samples = Math.floor(audioBase64.length * 3 / 4 / 2)
          audioStatsRef.current.chunks += 1
          audioStatsRef.current.samples += samples
          if (audioStatsRef.current.chunks <= 3 || audioStatsRef.current.chunks % 50 === 0) {
            console.debug('[voice] PCM chunk', {
              chunk: audioStatsRef.current.chunks,
              samples,
              totalSamples: audioStatsRef.current.samples,
              sampleRate: 24000,
              channels: 1,
            })
          }
          const payload = JSON.stringify({ type: 'input_audio_buffer.append', audio: audioBase64 })
          console.debug('[voice] WebSocket send input_audio_buffer.append', { base64Chars: audioBase64.length })
          ws.send(payload)
        }
        source.connect(processor)
        processor.connect(ctx.destination)
        setVoiceState(STATES.LISTENING)
      } catch (err) {
        console.error('[voice] Microphone setup failed', err)
        setError(err.name === 'NotAllowedError'
          ? 'Microphone permission was denied. Allow microphone access and retry.'
          : err.message || 'Microphone setup failed.')
        setVoiceState(STATES.ERROR)
        ws.close()
      }
    }

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data)
        console.debug('[voice] WebSocket received', event.type)
        handleEvent(event)
      } catch (err) {
        console.error('[voice] Invalid server message', err)
      }
    }

    ws.onerror = (event) => {
      console.error('[voice] WebSocket error', event)
      setError('Voice connection failed. Check the backend logs for the Azure error.')
      setVoiceState(STATES.ERROR)
      activeRef.current = false
    }

    ws.onclose = () => {
      console.info('[voice] WebSocket closed', ws.code, ws.reason)
      stopMic()
      clearPlayback()
      if (activeRef.current) setVoiceState(STATES.IDLE)
      activeRef.current = false
    }
  }, [handleEvent, stopMic, clearPlayback])

  const disconnect = useCallback(() => {
    activeRef.current = false
    wsRef.current?.close()
    stopMic()
    clearPlayback()
    setVoiceState(STATES.IDLE)
  }, [stopMic, clearPlayback])

  const interrupt = useCallback(() => {
    clearPlayback()
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'response.cancel' }))
    }
  }, [clearPlayback])

  useEffect(() => () => { activeRef.current = false; wsRef.current?.close(); stopMic() }, [stopMic])

  return { voiceState, transcript, error, toolEvents, connect, disconnect, interrupt }
}
