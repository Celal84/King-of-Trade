import { Bell, CandlestickChart, List, PieChart, ScanSearch, Wallet } from 'lucide-react'
import { useApp, type PanelTab } from '../store/app'

interface Props {
  drawer: boolean
  setDrawer: (v: boolean) => void
  onAlerts: () => void
}

export default function MobileNav({ drawer, setDrawer, onAlerts }: Props) {
  const { tab, set } = useApp()
  const open = (t: PanelTab) => {
    set({ tab: t })
    setDrawer(true)
  }
  const item = (on: boolean, label: string, I: typeof List, onClick: () => void) => (
    <button className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] ${on ? 'text-[#5b8cff]' : 'text-mute'}`} onClick={onClick}>
      <I size={18} />{label}
    </button>
  )
  return (
    <nav className="flex h-14 bg-panel border-t border-line shrink-0">
      {item(!drawer, 'Grafik', CandlestickChart, () => setDrawer(false))}
      {item(drawer && tab === 'watch', 'Liste', List, () => open('watch'))}
      {item(drawer && tab === 'scan', 'Tarama', ScanSearch, () => open('scan'))}
      {item(drawer && tab === 'fund', 'Temel', PieChart, () => open('fund'))}
      {item(drawer && tab === 'paper', 'Portföy', Wallet, () => open('paper'))}
      {item(false, 'Alarm', Bell, onAlerts)}
    </nav>
  )
}
