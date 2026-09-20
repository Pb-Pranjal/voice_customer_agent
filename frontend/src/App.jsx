import { useState } from 'react'
import { useVoice } from './hooks/useVoice'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import VoiceAssistant from './pages/VoiceAssistant'
import OrderLookup from './pages/OrderLookup'
import RefundRequest from './pages/RefundRequest'
import HumanEscalation from './pages/HumanEscalation'
import ConversationHistory from './pages/ConversationHistory'
import SettingsPage from './pages/Settings'

export default function App() {
  const [page, setPage] = useState('overview')
  const voice = useVoice()

  const renderPage = () => {
    switch (page) {
      case 'overview':   return <Overview onNavigate={setPage} />
      case 'voice':      return <VoiceAssistant {...voice} />
      case 'orders':     return <OrderLookup />
      case 'refund':     return <RefundRequest />
      case 'escalation': return <HumanEscalation />
      case 'history':    return <ConversationHistory transcript={voice.transcript} />
      case 'settings':   return <SettingsPage />
      default:           return <Overview onNavigate={setPage} />
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={page} onNavigate={setPage} />
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
        {renderPage()}
      </main>
    </div>
  )
}
