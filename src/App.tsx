import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import DrawingToolbar from './components/DrawingToolbar'
import ChartGrid from './components/ChartGrid'
import RightPanel from './components/RightPanel'
import ReplayBar from './components/ReplayBar'
import BottomBar from './components/BottomBar'
import MobileNav from './components/MobileNav'
import SymbolSearch from './components/SymbolSearch'
import IndicatorMenu from './components/IndicatorMenu'
import IndicatorSettings from './components/IndicatorSettings'
import { useApp } from './store/app'
import AlertsPanel from './components/AlertsPanel'
import SettingsModal from './components/SettingsModal'
import { useIsLandscapePhone, useIsMobile } from './hooks/useIsMobile'
import { usePriceFeed } from './hooks/usePriceFeed'
import { useAlertEngine } from './hooks/useAlertEngine'
import { useCryptoUniverse } from './hooks/useCrypto'
import { useReplay } from './store/replay'
import { useCloudSync } from './lib/sync'
import { PineSettings } from './components/PineEditor'
import { PINE_PREFIX } from './lib/pine'
import TxForm from './components/TxForm'

type ModalKind = 'search' | 'compare' | 'indicators' | 'alerts' | 'settings' | null

export default function App() {
  const mobile = useIsMobile()
  const landscape = useIsLandscapePhone()
  const replay = useReplay((s) => s.active)
  const editIndicator = useApp((s) => s.editIndicator)
  const proxyDown = useApp((s) => s.proxyDown)
  const txForm = useApp((s) => s.txForm)
  const [modal, setModal] = useState<ModalKind>(null)
  const [drawer, setDrawer] = useState(false)
  const close = () => setModal(null)
  usePriceFeed()
  useAlertEngine()
  useCryptoUniverse()
  useCloudSync()

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
      <TopBar onSearch={() => setModal('search')} onIndicators={() => setModal('indicators')} onCompare={() => setModal('compare')} onAlerts={() => setModal('alerts')} onSettings={() => setModal('settings')} onList={landscape ? () => setDrawer(!drawer) : undefined} />
      {proxyDown && (
        <button className="shrink-0 px-2 py-1 text-xs text-left bg-down/20 text-down" onClick={() => useApp.getState().set({ proxyDown: false })}>
          ⚠ Veri proxy’sine ulaşılamıyor; yedek kaynak kullanılıyor (veri gecikmeli olabilir). Kapatmak için dokunun.
        </button>
      )}
      {replay && <ReplayBar />}
      <div className="flex flex-1 min-h-0 relative">
        <DrawingToolbar />
        <ChartGrid mobile={mobile} />
        {!mobile && <aside className="w-[340px] border-l border-line shrink-0"><RightPanel /></aside>}
        {mobile && drawer && (
          <div className={`absolute z-40 overflow-hidden shadow-2xl border-line ${landscape ? 'inset-y-0 right-0 w-[340px] max-w-[75%] border-l' : 'inset-x-0 bottom-0 h-[70%] border-t rounded-t-xl'}`}>
            <RightPanel onPick={() => setDrawer(false)} />
          </div>
        )}
      </div>
      <BottomBar />
      {mobile && !landscape && <MobileNav drawer={drawer} setDrawer={setDrawer} onAlerts={() => setModal('alerts')} />}
      {modal === 'search' && <SymbolSearch onClose={close} />}
      {modal === 'compare' && <SymbolSearch onClose={close} compareMode />}
      {modal === 'indicators' && <IndicatorMenu onClose={close} />}
      {editIndicator && (editIndicator.startsWith(PINE_PREFIX)
        ? <PineSettings name={editIndicator.slice(PINE_PREFIX.length)} onClose={() => useApp.getState().set({ editIndicator: null })} />
        : <IndicatorSettings name={editIndicator} onClose={() => useApp.getState().set({ editIndicator: null })} />)}
      {modal === 'alerts' && <AlertsPanel onClose={close} />}
      {modal === 'settings' && <SettingsModal onClose={close} />}
      {txForm && <TxForm draft={txForm} onClose={() => useApp.getState().set({ txForm: null })} />}
    </div>
  )
}
