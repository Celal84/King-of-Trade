import { useState } from 'react'
import { Brush, Eye, EyeOff, GitFork, Magnet, Redo2, Ruler, Shapes, Slash, Smile, Trash2, Type, Undo2, type LucideIcon } from 'lucide-react'
import { useApp } from '../store/app'
import { paneApis } from '../lib/chartRegistry'

const GROUPS: [string, LucideIcon, [string, string][]][] = [
  ['Çizgiler', Slash, [
    ['segment', 'Trend Çizgisi'], ['rayLine', 'Işın'], ['straightLine', 'Uzatılmış Çizgi'], ['kotArrow', 'Ok'],
    ['horizontalStraightLine', 'Yatay Çizgi'], ['horizontalRayLine', 'Yatay Işın'], ['horizontalSegment', 'Yatay Parça'],
    ['verticalStraightLine', 'Dikey Çizgi'], ['priceLine', 'Fiyat Çizgisi'],
  ]],
  ['Kanal ve Fibonacci', GitFork, [['parallelStraightLine', 'Paralel Kanal'], ['priceChannelLine', 'Fiyat Kanalı'], ['fibonacciLine', 'Fibonacci Düzeltmesi'], ['kotFibExt', 'Fibonacci Uzatması (A → B → C)'], ['kotGann', 'Gann Yelpazesi']]],
  ['Şekiller', Shapes, [['kotRect', 'Dikdörtgen'], ['kotCircle', 'Daire'], ['kotTriangle', 'Üçgen'], ['kotWave', 'Dalga (0–5, altı nokta)'], ['kotXabcd', 'XABCD Formasyonu (beş nokta)']]],
  ['Ölçüm ve Pozisyon', Ruler, [['kotMeasure', 'Fiyat Ölçer'], ['kotPosition', 'Al/Sat Pozisyonu (giriş → hedef → stop)']]],
  ['Metin ve Not', Type, [['kotText', 'Metin'], ['simpleAnnotation', 'Not (ok işaretli)'], ['simpleTag', 'Fiyat Etiketi']]],
]
const EMOJIS = ['🚀', '🎯', '⭐', '🔥', '💰', '👍', '👎', '⚠️', '❗', '❓', '🟢', '🔴', '⬆️', '⬇️', '🐂', '🐻']

export default function DrawingToolbar() {
  const { active, magnet, drawingsVisible, drawColor, drawSize, set } = useApp()
  const [open, setOpen] = useState<{ i: number; top: number } | null>(null)
  const [emoji, setEmoji] = useState<number | null>(null)
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
      {tool('Fırça (serbest çizim)', Brush, () => api()?.draw('kotBrush'))}
      <button className={`btn px-0 w-8 justify-center ${emoji !== null ? 'btn-on' : ''}`} title="Emoji" aria-label="Emoji" onClick={(e) => setEmoji(emoji === null ? e.currentTarget.getBoundingClientRect().top : null)}><Smile size={16} /></button>
      <div className="w-6 border-t border-line my-1" />
      {tool('Mıknatıs modu', Magnet, () => set({ magnet: !magnet }), magnet ? 'btn-on' : '')}
      {tool(drawingsVisible ? 'Çizimleri gizle' : 'Çizimleri göster', drawingsVisible ? Eye : EyeOff, () => set({ drawingsVisible: !drawingsVisible }))}
      {tool('Geri al (son çizimi sil)', Undo2, () => api()?.undo())}
      {tool('Yinele (silinen çizimi geri getir)', Redo2, () => api()?.redo())}
      {tool('Tüm çizimleri temizle', Trash2, () => confirm('Bu sembolün tüm çizimleri silinsin mi?') && api()?.clear(), 'text-down')}
      <div className="w-6 border-t border-line my-1" />
      <input type="color" className="w-7 h-7 bg-transparent shrink-0" title="Çizim rengi" value={drawColor} onChange={(e) => set({ drawColor: e.target.value })} />
      <button className="btn px-0 w-8 justify-center" title="Çizgi kalınlığı" onClick={() => set({ drawSize: (drawSize % 4) + 1 })}>{drawSize}px</button>
      {emoji !== null && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setEmoji(null)} />
          <div className="fixed left-11 z-50 bg-panel border border-line rounded shadow-xl p-1 grid grid-cols-4 gap-0.5" style={{ top: Math.min(emoji, window.innerHeight - 200) }}>
            {EMOJIS.map((x) => <button key={x} className="btn w-9 h-9 justify-center text-lg" onClick={() => (api()?.draw('kotEmoji', x), setEmoji(null))}>{x}</button>)}
          </div>
        </>
      )}
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
