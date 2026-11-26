import { useEffect, useRef, useState } from 'react'
import { CalendarSearch, Camera, StickyNote, ChevronsRight, FoldVertical, Maximize, RotateCcw, UnfoldVertical, ZoomIn, ZoomOut } from 'lucide-react'
import { useApp } from '../store/app'
import { paneApis } from '../lib/chartRegistry'
import type { Timeframe } from '../types'

const DAY = 86_400_000
const ytd = () => Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()
const RANGES: [string, Timeframe, () => number][] = [
  ['1G', '5m', () => DAY], ['5G', '15m', () => 5 * DAY], ['1A', '1h', () => 31 * DAY], ['3A', '1d', () => 92 * DAY], ['6A', '1d', () => 183 * DAY],
  ['YBB', '1d', ytd], ['1Y', '1d', () => 366 * DAY], ['5Y', '1w', () => 5 * 366 * DAY], ['Tümü', '1w', () => 100 * 366 * DAY],
]

function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="text-[11px] text-mute tabular-nums whitespace-nowrap px-1" title="Türkiye saati">{now.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })} (UTC+3)</span>
}

export default function BottomBar() {
  const { active, logScale, percentScale, panes, notes, setNote, set } = useApp()
  const dateRef = useRef<HTMLInputElement>(null)
  const editNote = () => {
    const text = window.prompt(`${panes[active]} için not (boş bırakırsanız silinir):`, notes[panes[active]] ?? '')
    if (text !== null) setNote(panes[active], text.trim())
  }
  const api = () => paneApis.get(active)
  const icon = (title: string, I: typeof ZoomIn, fn: () => void) => (
    <button className="btn px-1.5" title={title} aria-label={title} onClick={fn}><I size={15} /></button>
  )
  return (
    <footer className="flex items-center gap-0.5 h-9 px-1 bg-panel border-t border-line overflow-x-auto no-scrollbar shrink-0">
      {RANGES.map(([label, tf, ms]) => (
        <button key={label} className="btn px-1.5" onClick={() => api()?.fit(ms(), tf)}>{label}</button>
      ))}
      <button className="btn px-1.5 relative" title="Tarihe git" aria-label="Tarihe git" onClick={() => dateRef.current?.showPicker?.()}>
        <CalendarSearch size={15} />
        <input ref={dateRef} type="date" className="absolute inset-0 opacity-0 w-full" aria-label="Tarih" onChange={(e) => e.target.valueAsNumber && api()?.goTo(e.target.valueAsNumber)} />
      </button>
      <div className="flex items-center gap-0.5 ml-auto pl-2">
        <Clock />
        <span className="text-[10px] text-mute hidden sm:inline">Zaman</span>
        {icon('Uzaklaştır', ZoomOut, () => api()?.zoom(0.7))}
        {icon('Yakınlaştır', ZoomIn, () => api()?.zoom(1.4))}
        <span className="text-[10px] text-mute hidden sm:inline ml-1">Fiyat</span>
        {icon('Fiyat ölçeğini daralt (mumları küçült)', FoldVertical, () => api()?.scalePrice(1.25))}
        {icon('Fiyat ölçeğini genişlet (mumları büyüt)', UnfoldVertical, () => api()?.scalePrice(0.8))}
        <button className="btn px-1.5" title="Fiyat ölçeğini otomatik ayarla" onClick={() => api()?.autoPrice()}>Oto</button>
        <button className={`btn px-1.5 ${percentScale ? 'btn-on' : ''}`} title="Yüzde ölçeği" onClick={() => set({ percentScale: !percentScale })}>%</button>
        <button className={`btn px-1.5 ${logScale ? 'btn-on' : ''}`} title="Logaritmik ölçek" onClick={() => set({ logScale: !logScale })}>Log</button>
        {icon('Son muma git', ChevronsRight, () => api()?.toLatest())}
        {icon('Görünümü sıfırla', RotateCcw, () => api()?.reset())}
        {icon('Sembol notu', StickyNote, editNote)}
        {icon('Grafiği resim olarak kaydet', Camera, () => api()?.screenshot())}
        {icon('Tam ekran', Maximize, () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()))}
      </div>
    </footer>
  )
}
