import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Info, ListPlus, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { CRYPTO_QUOTES, INDEX_LIST, INDEX_MEMBERS, SYMBOLS, displayName, getSymbol, isIndex } from '../data/symbols'
import { SECTION, isSection, useApp, useFavorites, useListEntries } from '../store/app'
import SymbolSearch from './SymbolSearch'
import SymbolDetail from './SymbolDetail'
import { useTickers } from '../hooks/useCrypto'
import { fmt } from '../lib/candles'
import type { Category } from '../types'

const TABS: [Category | 'FAV', string][] = [['FAV', 'Listelerim'], ['BIST', 'BIST'], ['EMTIA', 'Emtia & Döviz'], ['SENTETIK', 'Sentetik'], ['KRIPTO', 'Kripto']]
const CRYPTO_LIMIT = 200

export default function Watchlist({ onPick }: { onPick?: () => void }) {
  const [tab, setTab] = useState<Category | 'FAV'>('FAV')
  const [group, setGroup] = useState('XU030')
  const [quote, setQuote] = useState<string>('USDT')
  const { prices, panes, active, lists, listIdx, setSymbol, toggleFavorite, addList, renameList, removeList, addSection, renameSection, removeEntry, moveEntry, set } = useApp()
  const favorites = useFavorites()
  const entries = useListEntries()
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [closed, setClosed] = useState<string[]>([])
  const [drag, setDrag] = useState<number | null>(null)
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
  /** Görüntülenecek satırlar: kendi listemde bölümler ve kapalı bölümler dikkate alınır. */
  const rows = useMemo(() => {
    if (tab !== 'FAV') return list.map((s, index) => ({ entry: s.symbol, index }))
    let hidden = false
    return entries.flatMap((entry, index) => {
      if (isSection(entry)) hidden = closed.includes(entry.slice(SECTION.length))
      return isSection(entry) || !hidden ? [{ entry, index }] : []
    })
  }, [tab, list, entries, closed])
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex overflow-x-auto no-scrollbar border-b border-line shrink-0">
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'FAV' && (
        <div className="flex items-center border-b border-line shrink-0">
          <select className="inp h-7 text-xs rounded-none border-0 flex-1" value={listIdx} onChange={(e) => set({ listIdx: +e.target.value })}>
            {lists.map((l, i) => <option key={i} value={i}>{l.name} ({l.symbols.filter((x) => !isSection(x)).length})</option>)}
          </select>
          <button className="btn h-7" title="Sembol ekle" aria-label="Sembol ekle" onClick={() => setAdding(true)}><Plus size={15} /></button>
          <button className="btn h-7" title="Bölüm ekle" aria-label="Bölüm ekle" onClick={() => { const n = ask('Bölüm adı:'); if (n) addSection(n) }}><ListPlus size={15} /></button>
          <select className="inp h-7 w-9 px-1 text-xs rounded-none border-0" value="" title="Liste işlemleri" aria-label="Liste işlemleri" onChange={(e) => {
            const v = e.target.value
            if (v === 'new') { const n = ask('Yeni liste adı:'); if (n) addList(n) }
            if (v === 'rename') { const n = ask('Liste adı:', lists[listIdx]?.name); if (n) renameList(n) }
            if (v === 'delete' && confirm(`"${lists[listIdx]?.name}" listesi silinsin mi?`)) removeList()
          }}>
            <option value="">⋯</option>
            <option value="new">Yeni liste</option>
            <option value="rename">Listeyi yeniden adlandır</option>
            {lists.length > 1 && <option value="delete">Listeyi sil</option>}
          </select>
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
      <div className="flex px-2 py-1 text-[10px] text-mute border-b border-line shrink-0"><span className="flex-1">Sembol</span><span className="w-20 text-right">Son</span><span className="w-16 text-right">Değ%</span><span className="w-10" /></div>
      <ul className="overflow-y-auto flex-1">
        {list.length === 0 && entries.length === 0 && <li className="p-3 text-xs text-mute">Liste boş. Üstteki + ile sembol ekleyin.</li>}
        {rows.map(({ entry, index }) => {
          const fav = tab === 'FAV'
          const dnd = fav ? {
            draggable: true,
            onDragStart: () => setDrag(index),
            onDragOver: (e: React.DragEvent) => e.preventDefault(),
            onDrop: () => (drag !== null && drag !== index && moveEntry(drag, index), setDrag(null)),
          } : {}
          if (isSection(entry)) {
            const name = entry.slice(SECTION.length)
            const shut = closed.includes(name)
            return (
              <li key={entry} {...dnd} className="group flex items-center gap-1 px-2 py-1.5 text-[10px] uppercase tracking-wide text-mute border-b border-line cursor-pointer"
                onClick={() => setClosed(shut ? closed.filter((x) => x !== name) : [...closed, name])}>
                {shut ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <span className="flex-1">{name}</span>
                <button className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label="Bölümü yeniden adlandır" onClick={(e) => { e.stopPropagation(); const n = ask('Bölüm adı:', name); if (n) renameSection(name, n) }}><Pencil size={12} /></button>
                <button className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100" aria-label="Bölümü sil" onClick={(e) => (e.stopPropagation(), removeEntry(index))}><Trash2 size={12} /></button>
              </li>
            )
          }
          const s = getSymbol(entry)
          const q = tickers[s.symbol] ?? prices[s.symbol]
          return (
            <li key={s.symbol} {...dnd} onClick={() => (setSymbol(s.symbol), setDetail(s.symbol), onPick?.())}
              className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-line/50 ${panes[active] === s.symbol ? 'bg-line/60' : ''}`}>
              {!fav && (
                <button onClick={(e) => (e.stopPropagation(), toggleFavorite(s.symbol))} aria-label="Listeye ekle/çıkar">
                  <Star size={12} className={favorites.includes(s.symbol) ? 'fill-yellow-400 text-yellow-400' : 'text-mute'} />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{displayName(s.symbol)}</div>
                <div className="text-[10px] text-mute truncate">{s.name}</div>
              </div>
              <div className="w-20 text-right text-xs tabular-nums">{fmt(q?.price)}</div>
              <div className={`w-16 text-right text-xs tabular-nums ${(q?.change ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{q ? `${q.change >= 0 ? '+' : ''}${fmt(q.change, 2)}%` : ''}</div>
              <span className="flex justify-end gap-1.5 w-10">
                <button className="text-mute hover:text-txt" aria-label={`${displayName(s.symbol)} ayrıntıları`} onClick={(e) => (e.stopPropagation(), setDetail(s.symbol))}><Info size={13} /></button>
                {fav && <button className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 text-mute hover:text-down" aria-label={`${displayName(s.symbol)} listeden çıkar`} onClick={(e) => (e.stopPropagation(), removeEntry(index))}><Trash2 size={13} /></button>}
              </span>
            </li>
          )
        })}
      </ul>
      {detail && <SymbolDetail symbol={detail} onClose={() => setDetail(null)} />}
      {adding && <SymbolSearch addMode onClose={() => setAdding(false)} />}
    </div>
  )
}
