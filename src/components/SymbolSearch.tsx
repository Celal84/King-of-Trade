import { useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import Modal from './Modal'
import { CATEGORIES, SYMBOLS, displayName, fold } from '../data/symbols'
import { useApp } from '../store/app'
import type { Category } from '../types'

const LIMIT = 80

export default function SymbolSearch({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'ALL'>('ALL')
  const { favorites, toggleFavorite, setSymbol } = useApp()
  const list = useMemo(() => {
    const t = fold(q.trim())
    return SYMBOLS.filter((s) => (cat === 'ALL' || s.category === cat) && (!t || fold(s.symbol).includes(t) || fold(s.name).includes(t)))
      .sort((a, b) => +fold(b.symbol).startsWith(t) - +fold(a.symbol).startsWith(t))
  }, [q, cat])
  const pick = (s: string) => {
    setSymbol(s)
    onClose()
  }
  return (
    <Modal title="Sembol Ara" onClose={onClose}>
      <input autoFocus className="inp" placeholder={`${SYMBOLS.length} sembolde ara: THYAO, XBANK, Altın…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && list[0] && pick(list[0].symbol)} />
      <div className="flex gap-1 my-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`btn ${cat === c.key ? 'btn-on' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
        ))}
      </div>
      <ul className="divide-y divide-line">
        {list.slice(0, LIMIT).map((s) => (
          <li key={s.symbol} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-line/50 px-1" onClick={() => pick(s.symbol)}>
            <button onClick={(e) => (e.stopPropagation(), toggleFavorite(s.symbol))} aria-label="Favori">
              <Star size={14} className={favorites.includes(s.symbol) ? 'fill-yellow-400 text-yellow-400' : 'text-mute'} />
            </button>
            <span className="font-semibold text-sm w-24">{displayName(s.symbol)}</span>
            <span className="text-xs text-mute truncate flex-1">{s.name}</span>
            <span className="text-[10px] text-mute border border-line rounded px-1">{s.sector ?? s.category}</span>
          </li>
        ))}
        {list.length > LIMIT && <li className="py-2 text-xs text-mute">{list.length - LIMIT} sonuç daha var; aramayı daraltın.</li>}
      </ul>
    </Modal>
  )
}
