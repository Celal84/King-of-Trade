import { useEffect, useState } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { displayName, getSymbol } from '../data/symbols'
import { fmt, fmtBig } from '../lib/candles'
import type { Fundamentals as F } from '../types'

export default function Fundamentals() {
  const symbol = useApp((s) => s.panes[s.active])
  const info = getSymbol(symbol)
  const ok = info.category === 'BIST' && info.sector !== 'Endeks'
  const [data, setData] = useState<F | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!ok) return
    let alive = true
    setData(null)
    setErr(false)
    MarketRouter.getFundamentals(symbol).then((d) => alive && setData(d)).catch(() => alive && setErr(true))
    return () => {
      alive = false
    }
  }, [symbol, ok])
  if (!ok) return <p className="p-3 text-xs text-mute">Temel analiz yalnızca BIST hisseleri için gösterilir.</p>
  if (err) return <p className="p-3 text-xs text-down">Temel veriler alınamadı.</p>
  if (!data) return <p className="p-3 text-xs text-mute">Yükleniyor…</p>
  const range = data.high52 && data.low52 && data.price ? ((data.price - data.low52) / (data.high52 - data.low52)) * 100 : undefined
  const rows: [string, string][] = [
    ['Fiyat', `${fmt(data.price)} ${data.currency ?? ''}`],
    ['F/K', fmt(data.pe, 2)],
    ['PD/DD', fmt(data.pb, 2)],
    ['Piyasa Değeri', `${fmtBig(data.marketCap)} ₺`],
    ['52H Düşük', fmt(data.low52)],
    ['52H Yüksek', fmt(data.high52)],
    ['Sektör', info.sector ?? '—'],
  ]
  return (
    <div className="p-3 text-sm">
      <h3 className="font-semibold mb-2">{displayName(symbol)} <span className="text-mute font-normal text-xs">{info.name}</span></h3>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between py-1.5"><dt className="text-mute text-xs">{k}</dt><dd className="tabular-nums text-xs">{v}</dd></div>
        ))}
      </dl>
      {range !== undefined && (
        <div className="mt-3">
          <p className="text-xs text-mute mb-1">52 Haftalık Aralık</p>
          <div className="h-1.5 bg-line rounded relative">
            <div className="absolute -top-1 w-1 h-3.5 bg-acc rounded" style={{ left: `${Math.min(100, Math.max(0, range))}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}
