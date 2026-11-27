import { useMemo, useState } from 'react'
import { Check, Plus, Star } from 'lucide-react'
import Modal from './Modal'
import { CATEGORIES, SYMBOLS, displayName, fold } from '../data/symbols'
import { useApp, useFavorites } from '../store/app'
import type { Category } from '../types'

const LIMIT = 80

export default function SymbolSearch({ onClose, compareMode, addMode, onPick }: { onClose: () => void; compareMode?: boolean; addMode?: boolean; onPick?: (symbol: string) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | 'ALL'>('ALL')
  const { toggleFavorite, setSymbol, compare, toggleCompare, cryptoCount, lists, listIdx } = useApp()
  const favorites = useFavorites()
  const list = useMemo(() => {
    const t = fold(q.trim())
    return SYMBOLS.filter((s) => (cat === 'ALL' || s.category === cat) && (!t || fold(s.symbol).includes(t) || fold(s.name).includes(t)))
      .sort((a, b) => +fold(b.symbol).startsWith(t) - +fold(a.symbol).startsWith(t))
  }, [q, cat, cryptoCount])
  const pick = (s: string) => {
    // Seçim modunda pencereyi kapatmak çağıranın işidir
    if (onPick) return onPick(s)
    if (compareMode) return toggleCompare(s)
    if (addMode) return toggleFavorite(s)
    setSymbol(s)
    onClose()
  }
  return (
    <Modal title={compareMode ? `Karşılaştır (${compare.length}/4)` : addMode ? `Sembol ekle — ${lists[listIdx]?.name ?? ''} (${favorites.length})` : 'Sembol Ara'} onClose={onClose}>
      {addMode && <p className="text-xs text-mute mb-2">Dokunduğunuz sembol listeye eklenir; ekli olana tekrar dokununca çıkarılır.</p>}
      {compareMode && <p className="text-xs text-mute mb-2">Seçilen semboller ana grafiğe yüzde ölçeğinde eklenir. Çıkarmak için tekrar dokunun.</p>}
      <input autoFocus className="inp" placeholder={`${SYMBOLS.length} sembolde ara: THYAO, XBANK, Altın…`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && list[0] && pick(list[0].symbol)} />
      <div className="flex gap-1 my-2 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((c) => (
          <button key={c.key} className={`btn ${cat === c.key ? 'btn-on' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
        ))}
      </div>
      <ul className="divide-y divide-line">
        {list.slice(0, LIMIT).map((s) => (
          <li key={s.symbol} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-line/50 px-1" onClick={() => pick(s.symbol)}>
            {addMode ? (favorites.includes(s.symbol) ? <Check size={15} className="text-up" /> : <Plus size={15} className="text-mute" />) : (
              <button onClick={(e) => (e.stopPropagation(), toggleFavorite(s.symbol))} aria-label="Favori">
                <Star size={14} className={favorites.includes(s.symbol) ? 'fill-yellow-400 text-yellow-400' : 'text-mute'} />
              </button>
            )}
            <span className={`font-semibold text-sm w-24 ${compareMode && compare.includes(s.symbol) ? 'text-[#5b8cff]' : ''}`}>{compareMode && compare.includes(s.symbol) ? '✓ ' : ''}{displayName(s.symbol)}</span>
            <span className="text-xs text-mute truncate flex-1">{s.name}</span>
            <span className="text-[10px] text-mute border border-line rounded px-1">{s.sector ?? s.category}</span>
          </li>
        ))}
        {list.length > LIMIT && <li className="py-2 text-xs text-mute">{list.length - LIMIT} sonuç daha var; aramayı daraltın.</li>}
      </ul>
    </Modal>
  )
}
