import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { INDEX_LIST, INDEX_MEMBERS, SYMBOLS, displayName, isIndex } from '../data/symbols'
import { useApp } from '../store/app'
import { fmt } from '../lib/candles'
import type { Category } from '../types'

const TABS: [Category | 'FAV', string][] = [['FAV', 'Favoriler'], ['BIST', 'BIST'], ['EMTIA', 'Emtia & Döviz'], ['SENTETIK', 'Sentetik'], ['KRIPTO', 'Kripto']]

export default function Watchlist({ onPick }: { onPick?: () => void }) {
  const [tab, setTab] = useState<Category | 'FAV'>('FAV')
  const [group, setGroup] = useState('XU030')
  const { favorites, prices, panes, active, setSymbol, toggleFavorite, set } = useApp()
  const list = useMemo(() => {
    if (tab === 'FAV') return SYMBOLS.filter((s) => favorites.includes(s.symbol))
    if (tab !== 'BIST') return SYMBOLS.filter((s) => s.category === tab)
    if (group === 'INDEX') return SYMBOLS.filter((s) => isIndex(s.symbol))
    const members = group === 'ALL' ? null : INDEX_MEMBERS[group]
    return SYMBOLS.filter((s) => s.category === 'BIST' && !isIndex(s.symbol) && (!members || members.has(s.symbol)))
  }, [tab, favorites, group])
  useEffect(() => set({ watchSymbols: list.map((s) => s.symbol) }), [list, set])
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex overflow-x-auto no-scrollbar border-b border-line shrink-0">
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'BIST' && (
        <select className="inp h-7 text-xs rounded-none border-x-0 border-t-0 shrink-0" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="INDEX">Endeksler</option>
          <option value="ALL">Tüm hisseler ({SYMBOLS.filter((s) => s.category === 'BIST').length - INDEX_LIST.length})</option>
          {INDEX_LIST.map(([c, n]) => <option key={c} value={c}>{n} ({INDEX_MEMBERS[c].size})</option>)}
        </select>
      )}
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
