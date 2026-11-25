import { useEffect, useMemo, useState } from 'react'
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react'
import { Snapshot } from '../adapters/snapshot'
import { CRYPTO_QUOTES, INDEX_LIST, INDEX_MEMBERS, getSymbol } from '../data/symbols'
import { useTickers } from '../hooks/useCrypto'
import { useApp } from '../store/app'
import { fmt, fmtBig } from '../lib/candles'
import type { Universe } from '../types'

type Fmt = 'pct' | 'big' | 'num'
const METRICS: [string, string, Fmt][] = [
  ['change', 'Günlük %', 'pct'], ['Perf.W', 'Haftalık %', 'pct'], ['Perf.1M', 'Aylık %', 'pct'], ['Perf.YTD', 'Yılbaşından %', 'pct'], ['Perf.Y', 'Yıllık %', 'pct'],
  ['volume', 'Hacim (lot)', 'big'], ['relative_volume_10d_calc', 'Göreli Hacim', 'num'], ['market_cap_basic', 'Piyasa Değeri', 'big'],
  ['price_earnings_ttm', 'F/K', 'num'], ['price_book_fq', 'PD/DD', 'num'], ['dividends_yield_current', 'Temettü Verimi %', 'num'],
  ['RSI', 'RSI(14)', 'num'], ['return_on_equity', 'Özkaynak Kârlılığı %', 'num'], ['debt_to_equity', 'Borç/Özkaynak', 'num'],
]
const PRESETS: [string, string, boolean][] = [
  ['Yükselenler', 'change', true], ['Düşenler', 'change', false], ['Hacim Patlaması', 'relative_volume_10d_calc', true],
  ['Aşırı Satım', 'RSI', false], ['Aşırı Alım', 'RSI', true], ['Düşük F/K', 'price_earnings_ttm', false], ['Temettü', 'dividends_yield_current', true],
]
const LIMIT = 150

const CRYPTO_SORTS: [string, 'change' | 'volume', boolean][] = [['Hacim', 'volume', true], ['Yükselenler', 'change', true], ['Düşenler', 'change', false]]

function CryptoScreener({ onPick }: { onPick?: () => void }) {
  const tickers = useTickers((s) => s.tickers)
  const setSymbol = useApp((s) => s.setSymbol)
  const [quote, setQuote] = useState<string>('USDT')
  const [sort, setSort] = useState(0)
  const [minVol, setMinVol] = useState(true)
  const rows = useMemo(() => {
    const [, key, desc] = CRYPTO_SORTS[sort]
    const all = Object.entries(tickers).filter(([s, t]) => s.endsWith(quote) && t.volume > 0)
    const floor = minVol ? (all.map(([, t]) => t.volume).sort((a, b) => b - a)[Math.floor(all.length / 3)] ?? 0) : 0
    return all.filter(([, t]) => t.volume >= floor).sort((a, b) => (a[1][key] - b[1][key]) * (desc ? -1 : 1)).slice(0, LIMIT)
  }, [tickers, quote, sort, minVol])
  if (!Object.keys(tickers).length) return <p className="p-3 text-xs text-mute">Binance verisi yükleniyor…</p>
  return (
    <>
      <div className="p-2 space-y-1.5 border-b border-line shrink-0">
        <div className="flex gap-1">{CRYPTO_QUOTES.map((q) => <button key={q} className={`btn h-6 border border-line ${quote === q ? 'btn-on' : ''}`} onClick={() => setQuote(q)}>{q}</button>)}</div>
        <div className="flex gap-1 items-center">
          {CRYPTO_SORTS.map(([l], i) => <button key={l} className={`btn h-6 border border-line ${sort === i ? 'btn-on' : ''}`} onClick={() => setSort(i)}>{l}</button>)}
          <label className="flex items-center gap-1 ml-auto text-mute"><input type="checkbox" checked={minVol} onChange={(e) => setMinVol(e.target.checked)} /> Düşük hacmi gizle</label>
        </div>
      </div>
      <ul className="overflow-y-auto flex-1">
        {rows.map(([s, t]) => (
          <li key={s} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-line/50" onClick={() => (setSymbol(s), onPick?.())}>
            <div className="flex-1 font-semibold">{getSymbol(s).name}</div>
            <div className="text-right tabular-nums">
              <div>{fmt(t.price)}</div>
              <div className={`text-[10px] ${t.change >= 0 ? 'text-up' : 'text-down'}`}>{t.change >= 0 ? '+' : ''}{fmt(t.change, 2)}%</div>
            </div>
            <div className="w-20 text-right tabular-nums text-mute">{fmtBig(t.volume)}</div>
          </li>
        ))}
        <li className="p-2 text-[10px] text-mute">{rows.length} parite · Binance spot, 24 saatlik canlı veri</li>
      </ul>
    </>
  )
}

export default function Screener({ onPick }: { onPick?: () => void }) {
  const [market, setMarket] = useState<'BIST' | 'KRIPTO'>('BIST')
  return (
    <div className="flex flex-col h-full min-h-0 text-xs">
      <div className="flex border-b border-line shrink-0">
        {(['BIST', 'KRIPTO'] as const).map((m) => <button key={m} className={`tab flex-1 ${market === m ? 'tab-on' : ''}`} onClick={() => setMarket(m)}>{m === 'BIST' ? 'BIST' : 'Kripto (Binance)'}</button>)}
      </div>
      {market === 'BIST' ? <BistScreener onPick={onPick} /> : <CryptoScreener onPick={onPick} />}
    </div>
  )
}

function BistScreener({ onPick }: { onPick?: () => void }) {
  const [uni, setUni] = useState<Universe | null>(null)
  const [err, setErr] = useState(false)
  const [group, setGroup] = useState('XU100')
  const [metric, setMetric] = useState('change')
  const [desc, setDesc] = useState(true)
  const setSymbol = useApp((s) => s.setSymbol)
  useEffect(() => {
    Snapshot.getUniverse().then(setUni, () => setErr(true))
  }, [])
  const rows = useMemo(() => {
    if (!uni) return []
    const [ci, pi, mi] = ['change', 'close', metric].map((c) => uni.cols.indexOf(c))
    const members = group === 'ALL' ? null : INDEX_MEMBERS[group]
    return Object.entries(uni.s)
      .filter(([code, r]) => r[mi] != null && (!members || members.has(`${code}.IS`)) && (metric !== 'price_earnings_ttm' || (r[mi] as number) > 0))
      .sort((a, b) => ((a[1][mi] as number) - (b[1][mi] as number)) * (desc ? -1 : 1))
      .slice(0, LIMIT)
      .map(([code, r]) => ({ code, price: r[pi], change: r[ci], value: r[mi] as number }))
  }, [uni, group, metric, desc])
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
