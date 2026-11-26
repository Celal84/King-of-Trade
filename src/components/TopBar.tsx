import { BarChart3, Bell, Columns2, Columns3, Crown, GitCompareArrows, Grid3x3, History, LayoutGrid, Search, Settings, Square } from 'lucide-react'
import pkg from '../../package.json'
import { useApp } from '../store/app'
import { useReplay } from '../store/replay'
import { displayName } from '../data/symbols'
import UpdateButton from './UpdateButton'
import { TIMEFRAMES, type CandleKind, type Ccy, type Layout } from '../types'

const KINDS: [CandleKind, string][] = [['candle', 'Mum'], ['hollow', 'Hollow'], ['heikin', 'Heikin Ashi'], ['line', 'Çizgi'], ['area', 'Alan']]
const CCYS: [Ccy, string, string][] = [['TRY', '₺', 'TL bazında göster'], ['USD', '$', 'USD bazında göster'], ['EUR', '€', 'EUR bazında göster']]
const LAYOUTS: [Layout, typeof Square][] = [['1x1', Square], ['1x2', Columns2], ['1x3', Columns3], ['2x2', LayoutGrid], ['2x3', Grid3x3]]

interface Props {
  onSearch: () => void
  onIndicators: () => void
  onCompare: () => void
  onAlerts: () => void
  onSettings: () => void
}

export default function TopBar({ onSearch, onIndicators, onCompare, onAlerts, onSettings }: Props) {
  const { panes, active, tf, candleKind, ccy, layout, compare, templates, saveTemplate, applyTemplate, set } = useApp()
  const onTemplate = (v: string) => {
    if (v === '+') {
      const name = window.prompt('Şablon adı (zaman dilimi, mum tipi ve indikatörler kaydedilir):')?.trim()
      if (name) saveTemplate(name)
    } else if (v) applyTemplate(+v)
  }
  const replay = useReplay()
  const toggleReplay = () =>
    replay.active ? replay.set({ active: false, playing: false, selecting: false, cursor: -1 }) : replay.set({ active: true, selecting: true, playing: false, cursor: -1, pane: active })
  return (
    <header className="flex items-center gap-1 h-11 px-2 bg-panel border-b border-line overflow-x-auto no-scrollbar shrink-0">
      <div className="flex items-center gap-1 mr-1 shrink-0 text-sm font-bold">
        <Crown size={18} className="text-yellow-400" />
        <span className="whitespace-nowrap">King of Trade <span className="text-mute font-normal text-xs">v{pkg.version}</span></span>
      </div>
      <button className="btn border border-line" onClick={onSearch} title="Sembol Ara (Ctrl+K)">
        <Search size={14} /> <span className="font-semibold">{displayName(panes[active])}</span>
      </button>
      <div className="flex">
        {CCYS.map(([k, l, t]) => (
          <button key={k} className={`btn px-2 ${ccy === k ? 'btn-on' : ''}`} title={`${t} (tekrar basınca orijinal para birimi)`} aria-label={t} onClick={() => set({ ccy: ccy === k ? 'ORG' : k })}>{l}</button>
        ))}
      </div>
      <div className="flex">
        {TIMEFRAMES.map((t) => (
          <button key={t} className={`btn px-1.5 ${tf === t ? 'btn-on' : ''}`} onClick={() => set({ tf: t })}>{t}</button>
        ))}
      </div>
      <select className="inp w-auto h-8 text-xs" value={candleKind} onChange={(e) => set({ candleKind: e.target.value as CandleKind })}>
        {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <button className="btn" onClick={onIndicators}><BarChart3 size={14} /> İndikatör</button>
      <select className="inp w-24 shrink-0 h-8 text-xs" value="" title="Grafik şablonları" aria-label="Grafik şablonları" onChange={(e) => onTemplate(e.target.value)}>
        <option value="">Kaydet ▾</option>
        <option value="+">+ Şablon olarak kaydet</option>
        {templates.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
      </select>
      <button className={`btn ${compare.length ? 'btn-on' : ''}`} onClick={onCompare}><GitCompareArrows size={14} /> Karşılaştır{compare.length ? ` (${compare.length})` : ''}</button>
      <div className="hidden md:flex">
        {LAYOUTS.map(([l, I]) => (
          <button key={l} className={`btn ${layout === l ? 'btn-on' : ''}`} onClick={() => set({ layout: l })} title={l}><I size={14} /></button>
        ))}
      </div>
      <button className={`btn ${replay.active ? 'btn-on' : ''}`} onClick={toggleReplay}><History size={14} /> Replay</button>
      <button className="btn" onClick={onAlerts}><Bell size={14} /> Alarm</button>
      <UpdateButton />
      <button className="btn" onClick={onSettings} aria-label="Ayarlar"><Settings size={14} /></button>
    </header>
  )
}
