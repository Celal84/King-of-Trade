import { useEffect, useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { Snapshot } from '../adapters/snapshot'
import { INDEX_LIST, INDEX_MEMBERS, getSymbol } from '../data/symbols'
import { useApp } from '../store/app'
import { fmt, fmtBig } from '../lib/candles'
import type { Universe } from '../types'
import ScreenerFilters, { METRICS, passes } from './ScreenerFilters'
import type { ScanRule } from '../store/app'

const PRESETS: [string, string, boolean][] = [
  ['Yükselenler', 'change', true], ['Düşenler', 'change', false], ['Hacim Patlaması', 'relative_volume_10d_calc', true],
  ['Aşırı Satım', 'RSI', false], ['Aşırı Alım', 'RSI', true], ['Düşük F/K', 'price_earnings_ttm', false], ['Temettü', 'dividends_yield_current', true],
]
const LIMIT = 150

export default function Screener({ onPick }: { onPick?: () => void }) {
  return <div className="flex flex-col h-full min-h-0 text-xs"><BistScreener onPick={onPick} /></div>
}

function BistScreener({ onPick }: { onPick?: () => void }) {
  const [uni, setUni] = useState<Universe | null>(null)
  const [err, setErr] = useState(false)
  const [group, setGroup] = useState('XU100')
  const [metric, setMetric] = useState('change')
  const [desc, setDesc] = useState(true)
  const [rules, setRules] = useState<ScanRule[]>([])
  const setSymbol = useApp((s) => s.setSymbol)
  useEffect(() => {
    Snapshot.getUniverse().then(setUni, () => setErr(true))
  }, [])
  const rows = useMemo(() => {
    if (!uni) return []
    const [ci, pi, mi] = ['change', 'close', metric].map((c) => uni.cols.indexOf(c))
    const members = group === 'ALL' ? null : INDEX_MEMBERS[group]
    return Object.entries(uni.s)
      .filter(([code, r]) => r[mi] != null && (!members || members.has(`${code}.IS`)) && (metric !== 'price_earnings_ttm' || (r[mi] as number) > 0) && passes(uni.cols, r, rules))
      .sort((a, b) => ((a[1][mi] as number) - (b[1][mi] as number)) * (desc ? -1 : 1))
      .slice(0, LIMIT)
      .map(([code, r]) => ({ code, price: r[pi], change: r[ci], value: r[mi] as number }))
  }, [uni, group, metric, desc, rules])
  if (err) return <p className="p-3 text-xs text-down">Tarama verisi alınamadı.</p>
  if (!uni) return <p className="p-3 text-xs text-mute">Yükleniyor…</p>
  const kind = METRICS.find(([k]) => k === metric)?.[2] ?? 'num'
  const show = (v: number) => (kind === 'pct' ? `${v >= 0 ? '+' : ''}${fmt(v, 2)}%` : kind === 'big' ? fmtBig(v) : fmt(v, 2))
  return (
    <>
      <div className="p-2 space-y-1.5 border-b border-line shrink-0">
        <div className="flex gap-1">
          <select className="inp h-7 text-xs" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="ALL">Tüm BIST</option>
            {INDEX_LIST.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
          <select className="inp h-7 text-xs" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn h-7 border border-line" title="Sıralama yönü" onClick={() => setDesc(!desc)}>
            {desc ? <ArrowDownWideNarrow size={14} /> : <ArrowUpNarrowWide size={14} />}
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {PRESETS.map(([l, m, d]) => (
            <button key={l} className={`btn h-6 border border-line ${metric === m && desc === d ? 'btn-on' : ''}`} onClick={() => (setMetric(m), setDesc(d))}>{l}</button>
          ))}
        </div>
        <ScreenerFilters rules={rules} onChange={setRules} />
      </div>
      <ul className="overflow-y-auto flex-1">
        {rows.map((r) => (
          <li key={r.code} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-line/50" onClick={() => (setSymbol(`${r.code}.IS`), onPick?.())}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{r.code}</div>
              <div className="text-[10px] text-mute truncate">{getSymbol(`${r.code}.IS`).name}</div>
            </div>
            <div className="text-right tabular-nums">
              <div>{fmt(r.price ?? undefined)}</div>
              <div className={`text-[10px] ${(r.change ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{r.change != null ? `${r.change >= 0 ? '+' : ''}${fmt(r.change, 2)}%` : ''}</div>
            </div>
            {metric !== 'change' && <div className="w-20 text-right tabular-nums font-semibold">{show(r.value)}</div>}
          </li>
        ))}
        <li className="p-2 text-[10px] text-mute">{rows.length} hisse · veri: {new Date(uni.t).toLocaleString('tr-TR')} (gecikmeli)</li>
      </ul>
    </>
  )
}
