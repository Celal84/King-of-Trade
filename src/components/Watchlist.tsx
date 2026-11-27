import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, BellPlus, ChevronDown, ChevronRight, ChevronUp, Flag, Info, LineChart, ListPlus, MoreVertical, Pencil, Plus, Star, Trash2, type LucideIcon } from 'lucide-react'
import { CRYPTO_QUOTES, INDEX_LIST, INDEX_MEMBERS, SYMBOLS, displayName, getSymbol, isIndex } from '../data/symbols'
import { SECTION, isSection, useApp, useFavorites, useListEntries } from '../store/app'
import SymbolSearch from './SymbolSearch'
import SymbolDetail from './SymbolDetail'
import Tick from './Tick'
import { useTickers } from '../hooks/useCrypto'
import { fmt } from '../lib/candles'
import type { Category } from '../types'

const TABS: [Category | 'FAV', string][] = [['FAV', 'Listelerim'], ['BIST', 'BIST'], ['EMTIA', 'Emtia & Döviz'], ['SENTETIK', 'Sentetik'], ['KRIPTO', 'Kripto']]
const CRYPTO_LIMIT = 200
const FLAGS = ['#ef5350', '#ff9800', '#26a69a', '#2962ff', '#e040fb']
const HOLD_MS = 500
// Dokunmatik ekranda tarayıcının sürükle-bırak hareketi basılı tutma menüsüyle çakışır; sürükleme yalnızca farede açık
const MOUSE = window.matchMedia('(hover: hover)').matches

export default function Watchlist({ onPick }: { onPick?: () => void }) {
  const [tab, setTab] = useState<Category | 'FAV'>('FAV')
  const [group, setGroup] = useState('XU030')
  const [quote, setQuote] = useState<string>('USDT')
  const { prices, panes, active, lists, listIdx, setSymbol, toggleFavorite, addList, renameList, removeList, addSection, renameSection, removeEntry, moveEntry, flags, setFlag, set } = useApp()
  const favorites = useFavorites()
  const entries = useListEntries()
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [closed, setClosed] = useState<string[]>([])
  const [drag, setDrag] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ symbol: string; index: number; x: number; y: number } | null>(null)
  const [swiped, setSwiped] = useState<string | null>(null)
  const touch = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(null)
  const skipClick = useRef(false)
  // Parmağı kaldırınca oluşan tıklama, yeni açılan menüyü kapatmasın
  const menuAt = useRef(0)
  const fav = tab === 'FAV'
  const release = () => {
    clearTimeout(touch.current?.timer)
    touch.current = null
  }
  /** Basılı tutma menüyü açar. */
  const press = (e: React.PointerEvent, symbol: string, index: number) => {
    const { clientX: x, clientY: y } = e
    skipClick.current = false
    touch.current = { x, y, timer: setTimeout(() => ((skipClick.current = true), (menuAt.current = Date.now()), setMenu({ symbol, index, x, y })), HOLD_MS) }
  }
  /** Sola kaydırma hızlı işlem düğmelerini açar, sağa kaydırma kapatır. */
  const slide = (e: React.PointerEvent, symbol: string) => {
    const t = touch.current
    if (!t) return
    const [dx, dy] = [e.clientX - t.x, e.clientY - t.y]
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(t.timer)
    if (Math.abs(dy) > 24 || Math.abs(dx) < 36) return
    skipClick.current = true
    setSwiped(dx < 0 ? symbol : null)
    release()
  }
  const item = (I: LucideIcon, label: string, fn: () => void, cls = '') => (
    <li><button className={`flex items-center gap-2 w-full px-3 py-1.5 hover:bg-line text-left ${cls}`} onClick={() => (fn(), setMenu(null))}><I size={14} /> {label}</button></li>
  )
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
      <div className="flex px-2 py-1 text-[10px] text-mute border-b border-line shrink-0"><span className="flex-1">Sembol</span><span className="w-20 text-right">Son</span><span className="w-14 text-right">Değ</span><span className="w-16 text-right">Değ%</span><span className="w-4" /></div>
      <ul className="overflow-y-auto flex-1 select-none" onScroll={() => swiped && setSwiped(null)}>
        {list.length === 0 && entries.length === 0 && <li className="p-3 text-xs text-mute">Liste boş. Üstteki + ile sembol ekleyin.</li>}
        {rows.map(({ entry, index }) => {
          const dnd = fav && MOUSE ? {
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
                <button aria-label="Bölümü yukarı taşı" onClick={(e) => (e.stopPropagation(), index > 0 && moveEntry(index, index - 1))}><ChevronUp size={12} /></button>
                <button aria-label="Bölümü aşağı taşı" onClick={(e) => (e.stopPropagation(), moveEntry(index, index + 1))}><ChevronDown size={12} /></button>
                <button aria-label="Bölümü yeniden adlandır" onClick={(e) => { e.stopPropagation(); const n = ask('Bölüm adı:', name); if (n) renameSection(name, n) }}><Pencil size={12} /></button>
                <button aria-label="Bölümü sil" onClick={(e) => (e.stopPropagation(), removeEntry(index))}><Trash2 size={12} /></button>
              </li>
            )
          }
          const s = getSymbol(entry)
          const q = tickers[s.symbol] ?? prices[s.symbol]
          const abs = q ? q.price - q.price / (1 + q.change / 100) : undefined
          const tone = (q?.change ?? 0) >= 0 ? 'text-up' : 'text-down'
          const open = swiped === s.symbol
          return (
            <li key={s.symbol} {...dnd} title={s.name} className="relative overflow-hidden border-b border-line/40" style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
              onPointerDown={(e) => press(e, s.symbol, index)} onPointerMove={(e) => slide(e, s.symbol)} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}
              onContextMenu={(e) => (e.preventDefault(), setMenu({ symbol: s.symbol, index, x: e.clientX, y: e.clientY }))}
              onClick={() => {
                if (skipClick.current) return void (skipClick.current = false)
                if (open) return setSwiped(null)
                setSymbol(s.symbol)
                setDetail(s.symbol)
                onPick?.()
              }}>
              <div className={`group flex items-center gap-2 pl-1 pr-2 h-8 cursor-pointer transition-transform hover:bg-line/50 ${panes[active] === s.symbol ? 'bg-line/60' : ''} ${open ? '-translate-x-[132px]' : ''}`}>
                <span className="w-1 h-4 rounded" style={{ background: flags[s.symbol] ?? 'transparent' }} />
                <span className="flex-1 min-w-0 truncate text-xs font-semibold">{displayName(s.symbol)}</span>
                <Tick value={q?.price} className="w-20 text-right text-xs tabular-nums">{fmt(q?.price)}</Tick>
                <span className={`w-14 text-right text-[11px] tabular-nums ${tone}`}>{abs !== undefined ? `${abs >= 0 ? '+' : ''}${fmt(abs, 2)}` : ''}</span>
                <span className={`w-16 text-right text-xs tabular-nums ${tone}`}>{q ? `${q.change >= 0 ? '+' : ''}${fmt(q.change, 2)}%` : ''}</span>
                <button className="w-4 text-mute [@media(hover:none)]:hidden opacity-0 group-hover:opacity-100" aria-label={`${displayName(s.symbol)} menüsü`}
                  onClick={(e) => (e.stopPropagation(), setMenu({ symbol: s.symbol, index, x: e.clientX, y: e.clientY }))}><MoreVertical size={13} /></button>
              </div>
              {open && (
                <div className="absolute inset-y-0 right-0 w-[132px] flex items-center justify-around bg-bg" onClick={(e) => e.stopPropagation()}>
                  <button className="w-7 h-7 rounded-full bg-acc text-white flex items-center justify-center" aria-label="İşlem" onClick={() => (set({ txForm: { symbol: s.symbol } }), setSwiped(null))}><ArrowLeftRight size={14} /></button>
                  <button className="w-7 h-7 rounded-full bg-[#ff9800] text-white flex items-center justify-center" aria-label="Alarm ekle" onClick={() => (set({ alertSymbol: s.symbol }), setSwiped(null))}><BellPlus size={14} /></button>
                  <button className="w-7 h-7 rounded-full bg-down text-white flex items-center justify-center" aria-label="Kaldır" onClick={() => ((fav ? removeEntry(index) : favorites.includes(s.symbol) && toggleFavorite(s.symbol)), setSwiped(null))}><Trash2 size={14} /></button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => Date.now() - menuAt.current > 600 && setMenu(null)} onContextMenu={(e) => e.preventDefault()} />
          <ul className="fixed z-50 w-56 bg-panel border border-line rounded-lg shadow-2xl py-1 text-xs" style={{ left: Math.max(4, Math.min(menu.x, window.innerWidth - 232)), top: Math.max(4, Math.min(menu.y, window.innerHeight - 330)) }}>
            <li className="px-3 py-1 text-mute font-semibold">{displayName(menu.symbol)}</li>
            <li className="flex items-center gap-2 px-3 py-1.5"><Flag size={14} /> <span className="flex-1">Bayrak</span>
              {FLAGS.map((c) => <button key={c} className="w-4 h-4 rounded-full" style={{ background: c }} aria-label={`Bayrak ${c}`} onClick={() => (setFlag(menu.symbol, c), setMenu(null))} />)}
              <button className="text-mute" aria-label="Bayrağı kaldır" onClick={() => (setFlag(menu.symbol, null), setMenu(null))}>✕</button>
            </li>
            {fav && item(ListPlus, 'Yukarıya bölüm ekle', () => { const n = ask('Bölüm adı:'); if (n) addSection(n, menu.index) })}
            {fav && item(ChevronUp, 'Yukarı taşı', () => menu.index > 0 && moveEntry(menu.index, menu.index - 1))}
            {fav && item(ChevronDown, 'Aşağı taşı', () => moveEntry(menu.index, menu.index + 1))}
            <li className="border-t border-line my-1" />
            {item(BellPlus, 'Alarm ekle', () => set({ alertSymbol: menu.symbol }))}
            {item(ArrowLeftRight, 'İşlem (portföye ekle / çıkar)', () => set({ txForm: { symbol: menu.symbol } }))}
            {item(LineChart, 'Grafiği aç', () => (setSymbol(menu.symbol), onPick?.()))}
            {item(Info, 'Sembol ekranını aç', () => setDetail(menu.symbol))}
            <li className="border-t border-line my-1" />
            {fav ? item(Trash2, 'Kaldır', () => removeEntry(menu.index), 'text-down')
              : item(Star, favorites.includes(menu.symbol) ? 'Listemden çıkar' : 'Listeme ekle', () => toggleFavorite(menu.symbol))}
          </ul>
        </>
      )}
      {detail && <SymbolDetail symbol={detail} onClose={() => setDetail(null)} />}
      {adding && <SymbolSearch addMode onClose={() => setAdding(false)} />}
    </div>
  )
}
