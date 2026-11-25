import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import DrawingToolbar from './components/DrawingToolbar'
import ChartGrid from './components/ChartGrid'
import RightPanel from './components/RightPanel'
import ReplayBar from './components/ReplayBar'
import MobileNav from './components/MobileNav'
import SymbolSearch from './components/SymbolSearch'
import IndicatorMenu from './components/IndicatorMenu'
import AlertsPanel from './components/AlertsPanel'
import SettingsModal from './components/SettingsModal'
import { useIsMobile } from './hooks/useIsMobile'
import { usePriceFeed } from './hooks/usePriceFeed'
import { useAlertEngine } from './hooks/useAlertEngine'
import { useReplay } from './store/replay'

type ModalKind = 'search' | 'indicators' | 'alerts' | 'settings' | null

export default function App() {
  const mobile = useIsMobile()
  const replay = useReplay((s) => s.active)
  const [modal, setModal] = useState<ModalKind>(null)
  const [drawer, setDrawer] = useState(false)
  const close = () => setModal(null)
  usePriceFeed()
  useAlertEngine()

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setModal('search')
      } else if (e.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="safe h-full flex flex-col bg-bg text-txt overflow-hidden">
      <TopBar onSearch={() => setModal('search')} onIndicators={() => setModal('indicators')} onAlerts={() => setModal('alerts')} onSettings={() => setModal('settings')} />
      {replay && <ReplayBar />}
      <div className="flex flex-1 min-h-0 relative">
        <DrawingToolbar />
        <ChartGrid mobile={mobile} />
        {!mobile && <aside className="w-80 border-l border-line shrink-0"><RightPanel /></aside>}
        {mobile && drawer && (
          <div className="absolute inset-x-0 bottom-0 h-[70%] z-40 border-t border-line rounded-t-xl overflow-hidden shadow-2xl">
            <RightPanel onPick={() => setDrawer(false)} />
          </div>
        )}
      </div>
      {mobile && <MobileNav drawer={drawer} setDrawer={setDrawer} onAlerts={() => setModal('alerts')} />}
      {modal === 'search' && <SymbolSearch onClose={close} />}
      {modal === 'indicators' && <IndicatorMenu onClose={close} />}
      {modal === 'alerts' && <AlertsPanel onClose={close} />}
      {modal === 'settings' && <SettingsModal onClose={close} />}
    </div>
  )
}
