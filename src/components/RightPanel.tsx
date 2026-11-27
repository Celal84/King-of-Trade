import { useApp, type PanelTab } from '../store/app'
import Watchlist from './Watchlist'
import Screener from './Screener'
import Fundamentals from './Fundamentals'
import Portfolio from './Portfolio'
import StrategyTester from './StrategyTester'

export const PANEL_TABS: [PanelTab, string][] = [['watch', 'İzleme'], ['scan', 'Tarama'], ['fund', 'Temel'], ['paper', 'Portföy'], ['test', 'Strateji']]

export default function RightPanel({ onPick }: { onPick?: () => void }) {
  const { tab, set } = useApp()
  return (
    <div className="flex flex-col h-full min-h-0 bg-panel">
      <div className="flex border-b border-line shrink-0">
        {PANEL_TABS.map(([k, l]) => <button key={k} className={`tab flex-1 ${tab === k ? 'tab-on' : ''}`} onClick={() => set({ tab: k })}>{l}</button>)}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'watch' && <Watchlist onPick={onPick} />}
        {tab === 'scan' && <Screener onPick={onPick} />}
        {tab === 'fund' && <Fundamentals />}
        {tab === 'paper' && <Portfolio onPick={onPick} />}
        {tab === 'test' && <StrategyTester />}
      </div>
    </div>
  )
}
