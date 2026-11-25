import { ArrowUpRight, Eye, EyeOff, Magnet, Minus, Ruler, SeparatorVertical, Slash, Trash2, Type, Equal, Percent, type LucideIcon } from 'lucide-react'
import { useApp } from '../store/app'
import { paneApis } from '../lib/chartRegistry'

const TOOLS: [string, string, LucideIcon][] = [
  ['segment', 'Trend Çizgisi', Slash],
  ['rayLine', 'Işın', ArrowUpRight],
  ['horizontalStraightLine', 'Yatay Çizgi', Minus],
  ['verticalStraightLine', 'Dikey Çizgi', SeparatorVertical],
  ['parallelStraightLine', 'Paralel Kanal', Equal],
  ['fibonacciLine', 'Fibonacci', Percent],
  ['kotMeasure', 'Fiyat Ölçer', Ruler],
  ['kotText', 'Metin', Type],
]

export default function DrawingToolbar() {
  const { active, magnet, drawingsVisible, set } = useApp()
  const api = () => paneApis.get(active)
  return (
    <nav className="flex flex-col items-center gap-0.5 w-10 py-1 bg-panel border-r border-line overflow-y-auto no-scrollbar shrink-0">
      {TOOLS.map(([name, title, I]) => (
        <button key={name} className="btn px-0 w-8 justify-center" title={title} onClick={() => api()?.draw(name)}><I size={16} /></button>
      ))}
      <div className="w-6 border-t border-line my-1" />
      <button className={`btn px-0 w-8 justify-center ${magnet ? 'btn-on' : ''}`} title="Mıknatıs modu" onClick={() => set({ magnet: !magnet })}><Magnet size={16} /></button>
      <button className="btn px-0 w-8 justify-center" title={drawingsVisible ? 'Çizimleri gizle' : 'Çizimleri göster'} onClick={() => set({ drawingsVisible: !drawingsVisible })}>
        {drawingsVisible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button className="btn px-0 w-8 justify-center text-down" title="Tüm çizimleri temizle" onClick={() => confirm('Bu sembolün tüm çizimleri silinsin mi?') && api()?.clear()}><Trash2 size={16} /></button>
    </nav>
  )
}
