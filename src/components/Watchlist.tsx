import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { SYMBOLS, displayName } from '../data/symbols'
import { useApp } from '../store/app'
import { fmt } from '../lib/candles'
import type { Category } from '../types'

const TABS: [Category | 'FAV', string][] = [['FAV', 'Favoriler'], ['BIST', 'BIST'], ['EMTIA', 'Emtia'], ['SENTETIK', 'Sentetik'], ['KRIPTO', 'Kripto']]

export default function Watchlist({ onPick }: { onPick?: () => void }) {
  const [tab, setTab] = useState<Category | 'FAV'>('FAV')
  const { favorites, prices, panes, active, setSymbol, toggleFavorite, set } = useApp()
  const list = useMemo(() => (tab === 'FAV' ? SYMBOLS.filter((s) => favorites.includes(s.symbol)) : SYMBOLS.filter((s) => s.category === tab)), [tab, favorites])
  useEffect(() => set({ watchSymbols: list.map((s) => s.symbol) }), [list, set])
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex overflow-x-auto no-scrollbar border-b border-line shrink-0">
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <ul className="overflow-y-auto flex-1">
        {list.length === 0 && <li className="p-3 text-xs text-mute">Favori yok. Yıldız ile ekleyin.</li>}
        {list.map((s) => {
          const q = prices[s.symbol]
          return (
            <li key={s.symbol} onClick={() => (setSymbol(s.symbol), onPick?.())}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-line/50 ${panes[active] === s.symbol ? 'bg-line/60' : ''}`}>
              <button onClick={(e) => (e.stopPropagation(), toggleFavorite(s.symbol))} aria-label="Favori">
                <Star size={12} className={favorites.includes(s.symbol) ? 'fill-yellow-400 text-yellow-400' : 'text-mute'} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{displayName(s.symbol)}</div>
                <div className="text-[10px] text-mute truncate">{s.name}</div>
              </div>
              <div className="text-right">
                <div className="text-xs tabular-nums">{fmt(q?.price)}</div>
                <div className={`text-[10px] tabular-nums ${(q?.change ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{q ? `${q.change >= 0 ? '+' : ''}${fmt(q.change, 2)}%` : ''}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
