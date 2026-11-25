import { useState } from 'react'
import { Eye, EyeOff, GitFork, Magnet, Ruler, Shapes, Slash, Trash2, Type, Undo2, type LucideIcon } from 'lucide-react'
import { useApp } from '../store/app'
import { paneApis } from '../lib/chartRegistry'

const GROUPS: [string, LucideIcon, [string, string][]][] = [
  ['Çizgiler', Slash, [
    ['segment', 'Trend Çizgisi'], ['rayLine', 'Işın'], ['straightLine', 'Uzatılmış Çizgi'], ['kotArrow', 'Ok'],
    ['horizontalStraightLine', 'Yatay Çizgi'], ['horizontalRayLine', 'Yatay Işın'], ['horizontalSegment', 'Yatay Parça'],
    ['verticalStraightLine', 'Dikey Çizgi'], ['priceLine', 'Fiyat Çizgisi'],
  ]],
  ['Kanal ve Fibonacci', GitFork, [['parallelStraightLine', 'Paralel Kanal'], ['priceChannelLine', 'Fiyat Kanalı'], ['fibonacciLine', 'Fibonacci Düzeltmesi']]],
  ['Şekiller', Shapes, [['kotRect', 'Dikdörtgen'], ['kotCircle', 'Daire'], ['kotTriangle', 'Üçgen']]],
  ['Ölçüm ve Pozisyon', Ruler, [['kotMeasure', 'Fiyat Ölçer'], ['kotPosition', 'Al/Sat Pozisyonu (giriş → hedef → stop)']]],
  ['Metin ve Not', Type, [['kotText', 'Metin'], ['simpleAnnotation', 'Not (ok işaretli)'], ['simpleTag', 'Fiyat Etiketi']]],
]

export default function DrawingToolbar() {
  const { active, magnet, drawingsVisible, set } = useApp()
  const [open, setOpen] = useState<{ i: number; top: number } | null>(null)
  const api = () => paneApis.get(active)
  const tool = (title: string, I: LucideIcon, onClick: () => void, cls = '') => (
    <button className={`btn px-0 w-8 justify-center ${cls}`} title={title} aria-label={title} onClick={onClick}><I size={16} /></button>
  )
  return (
    <nav className="flex flex-col items-center gap-0.5 w-10 py-1 bg-panel border-r border-line overflow-y-auto no-scrollbar shrink-0">
      {GROUPS.map(([title, I], i) => (
        <button key={title} className={`btn px-0 w-8 justify-center ${open?.i === i ? 'btn-on' : ''}`} title={title} aria-label={title}
          onClick={(e) => setOpen(open?.i === i ? null : { i, top: e.currentTarget.getBoundingClientRect().top })}><I size={16} /></button>
      ))}
      <div className="w-6 border-t border-line my-1" />
      {tool('Mıknatıs modu', Magnet, () => set({ magnet: !magnet }), magnet ? 'btn-on' : '')}
      {tool(drawingsVisible ? 'Çizimleri gizle' : 'Çizimleri göster', drawingsVisible ? Eye : EyeOff, () => set({ drawingsVisible: !drawingsVisible }))}
      {tool('Son çizimi sil', Undo2, () => api()?.undo())}
      {tool('Tüm çizimleri temizle', Trash2, () => confirm('Bu sembolün tüm çizimleri silinsin mi?') && api()?.clear(), 'text-down')}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
          <ul className="fixed left-11 z-50 bg-panel border border-line rounded shadow-xl py-1 min-w-48" style={{ top: Math.min(open.top, window.innerHeight - 330) }}>
            <li className="px-3 py-1 text-[10px] uppercase text-mute">{GROUPS[open.i][0]}</li>
            {GROUPS[open.i][2].map(([name, label]) => (
              <li key={name}><button className="btn w-full rounded-none px-3" onClick={() => (api()?.draw(name), setOpen(null))}>{label}</button></li>
            ))}
          </ul>
        </>
      )}
    </nav>
  )
}
