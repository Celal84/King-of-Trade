import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { CRYPTO_QUOTES, INDEX_LIST, INDEX_MEMBERS, SYMBOLS, displayName, getSymbol, isIndex } from '../data/symbols'
import { useApp, useFavorites } from '../store/app'
import { useTickers } from '../hooks/useCrypto'
import { fmt } from '../lib/candles'
import type { Category } from '../types'

const TABS: [Category | 'FAV', string][] = [['FAV', 'Listelerim'], ['BIST', 'BIST'], ['EMTIA', 'Emtia & Döviz'], ['SENTETIK', 'Sentetik'], ['KRIPTO', 'Kripto']]
const CRYPTO_LIMIT = 200

export default function Watchlist({ onPick }: { onPick?: () => void }) {
  const [tab, setTab] = useState<Category | 'FAV'>('FAV')
  const [group, setGroup] = useState('XU030')
  const [quote, setQuote] = useState<string>('USDT')
  const { prices, panes, active, lists, listIdx, setSymbol, toggleFavorite, addList, renameList, removeList, set } = useApp()
  const favorites = useFavorites()
  const tickers = useTickers((s) => s.tickers)
  const hasTickers = Object.keys(tickers).length > 0
  const list = useMemo(() => {
    if (tab === 'FAV') return favorites.map(getSymbol)
    if (tab === 'KRIPTO') {
      const t = useTickers.getState().tickers
      const all = Object.keys(t).filter((s) => s.endsWith(quote) && t[s].volume > 0).sort((a, b) => t[b].volume - t[a].volume)
      return all.length ? all.slice(0, CRYPTO_LIMIT).map(getSymbol) : SYMBOLS.filter((s) => s.category === 'KRIPTO')
    }
    if (tab !== 'BIST') return SYMBOLS.filter((s) => s.category === tab)
    if (group === 'INDEX') return SYMBOLS.filter((s) => isIndex(s.symbol))
    const members = group === 'ALL' ? null : INDEX_MEMBERS[group]
    return SYMBOLS.filter((s) => s.category === 'BIST' && !isIndex(s.symbol) && (!members || members.has(s.symbol)))
  }, [tab, favorites, group, quote, hasTickers])
  useEffect(() => set({ watchSymbols: list.map((s) => s.symbol) }), [list, set])
  const ask = (title: string, initial = '') => window.prompt(title, initial)?.trim()
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex overflow-x-auto no-scrollbar border-b border-line shrink-0">
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'FAV' && (
        <div className="flex items-center border-b border-line shrink-0">
          <select className="inp h-7 text-xs rounded-none border-0 flex-1" value={listIdx} onChange={(e) => set({ listIdx: +e.target.value })}>
            {lists.map((l, i) => <option key={i} value={i}>{l.name} ({l.symbols.length})</option>)}
          </select>
          <button className="btn h-7" title="Yeni liste" onClick={() => { const n = ask('Yeni liste adı:'); if (n) addList(n) }}><Plus size={14} /></button>
          <button className="btn h-7" title="Listeyi yeniden adlandır" onClick={() => { const n = ask('Liste adı:', lists[listIdx]?.name); if (n) renameList(n) }}><Pencil size={13} /></button>
          {lists.length > 1 && <button className="btn h-7 text-down" title="Listeyi sil" onClick={() => confirm(`"${lists[listIdx]?.name}" listesi silinsin mi?`) && removeList()}><Trash2 size={13} /></button>}
        </div>
      )}
      {tab === 'BIST' && (
        <select className="inp h-7 text-xs rounded-none border-x-0 border-t-0 shrink-0" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="INDEX">Endeksler</option>
          <option value="ALL">Tüm hisseler ({SYMBOLS.filter((s) => s.category === 'BIST').length - INDEX_LIST.length})</option>
          {INDEX_LIST.map(([c, n]) => <option key={c} value={c}>{n} ({INDEX_MEMBERS[c].size})</option>)}
        </select>
      )}
      {tab === 'KRIPTO' && (
        <div className="flex gap-1 p-1 border-b border-line shrink-0 items-center">
          {CRYPTO_QUOTES.map((q) => <button key={q} className={`btn h-6 ${quote === q ? 'btn-on' : ''}`} onClick={() => setQuote(q)}>{q}</button>)}
          <span className="text-[10px] text-mute ml-auto pr-1">Binance · hacme göre</span>
        </div>
      )}
      <ul className="overflow-y-auto flex-1">
        {list.length === 0 && <li className="p-3 text-xs text-mute">Liste boş. Arama veya diğer sekmelerden yıldızla ekleyin.</li>}
        {list.map((s) => {
          const q = tickers[s.symbol] ?? prices[s.symbol]
          return (
            <li key={s.symbol} onClick={() => (setSymbol(s.symbol), onPick?.())}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-line/50 ${panes[active] === s.symbol ? 'bg-line/60' : ''}`}>
              <button onClick={(e) => (e.stopPropagation(), toggleFavorite(s.symbol))} aria-label="Listeye ekle/çıkar">
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
