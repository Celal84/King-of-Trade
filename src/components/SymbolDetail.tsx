import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { displayName, getSymbol, indicesOf } from '../data/symbols'
import { fmt, fmtBig } from '../lib/candles'
import type { Fundamentals } from '../types'

type Kind = 'num' | 'big' | 'signed'
const STATS: [string, string, Kind][] = [
  ['volume', 'Hacim (lot)', 'big'], ['relative_volume_10d_calc', 'Göreli Hacim', 'num'], ['market_cap_basic', 'Piyasa Değeri', 'big'],
  ['price_earnings_ttm', 'F/K', 'num'], ['price_book_fq', 'PD/DD', 'num'], ['dividends_yield_current', 'Temettü %', 'num'], ['RSI', 'RSI(14)', 'num'],
  ['Perf.W', 'Haftalık', 'signed'], ['Perf.1M', 'Aylık', 'signed'], ['Perf.YTD', 'Yılbaşından', 'signed'], ['Perf.Y', 'Yıllık', 'signed'],
]
const show = (v: number, k: Kind) => (k === 'big' ? fmtBig(v) : k === 'signed' ? `${v >= 0 ? '+' : ''}${fmt(v, 2)}%` : fmt(v, 2))

/** Listede seçilen sembolün özet kartı: fiyat, 52 haftalık aralık, temel ve performans verileri. */
export default function SymbolDetail({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const info = getSymbol(symbol)
  const quote = useApp((s) => s.prices[symbol])
  const note = useApp((s) => s.notes[symbol])
  const set = useApp((s) => s.set)
  const [data, setData] = useState<Fundamentals | null>(null)
  useEffect(() => {
    let alive = true
    setData(null)
    if (info.source === 'yahoo') MarketRouter.getFundamentals(symbol).then((d) => alive && setData(d)).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [symbol, info.source])
  const q = quote
  const abs = q ? q.price - q.price / (1 + q.change / 100) : undefined
  const tone = (q?.change ?? 0) >= 0 ? 'text-up' : 'text-down'
  const range = data?.high52 && data.low52 && q ? ((q.price - data.low52) / (data.high52 - data.low52)) * 100 : undefined
  const stats = STATS.flatMap(([k, label, kind]) => {
    const v = data?.stats?.[k]
    return v == null ? [] : [[label, show(v, kind), kind === 'signed' ? (v >= 0 ? 'text-up' : 'text-down') : ''] as const]
  })
  const groups = indicesOf(symbol)
  return (
    <div className="border-t border-line shrink-0 max-h-[48%] overflow-y-auto p-2 text-xs space-y-2 bg-panel">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold">{displayName(symbol)}</div>
          <div className="text-mute truncate">{info.name}</div>
          <div className="text-[10px] text-mute">{[info.sector, info.category, info.currency].filter(Boolean).join(' · ')}</div>
        </div>
        <button className="btn px-1" onClick={onClose} aria-label="Ayrıntıyı kapat"><X size={14} /></button>
      </div>
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-xl font-semibold">{fmt(q?.price)}</span>
        {q && <span className={tone}>{q.change >= 0 ? '+' : ''}{fmt(abs)} ({q.change >= 0 ? '+' : ''}{fmt(q.change, 2)}%)</span>}
      </div>
      {range !== undefined && (
        <div>
          <div className="flex justify-between text-mute mb-1"><span>{fmt(data?.low52)}</span><span>52 Haftalık Aralık</span><span>{fmt(data?.high52)}</span></div>
          <div className="h-1.5 bg-line rounded relative"><div className="absolute -top-1 w-1 h-3.5 bg-acc rounded" style={{ left: `${Math.min(100, Math.max(0, range))}%` }} /></div>
        </div>
      )}
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3">
          {stats.map(([label, value, cls]) => <div key={label} className="flex justify-between py-0.5 border-b border-line/60"><dt className="text-mute">{label}</dt><dd className={`tabular-nums ${cls}`}>{value}</dd></div>)}
        </dl>
      )}
      {groups.length > 0 && <div className="flex flex-wrap gap-1">{groups.map((g) => <span key={g} className="border border-line rounded px-1.5 py-0.5 text-[10px]">{g}</span>)}</div>}
      {note && <p className="text-yellow-300">📝 {note}</p>}
      {stats.length > 0 && <button className="btn border border-line" onClick={() => set({ tab: 'fund' })}>Tüm temel veriler</button>}
    </div>
  )
}
