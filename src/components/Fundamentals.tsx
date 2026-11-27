import { useEffect, useState } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { displayName, getSymbol, indicesOf, isIndex } from '../data/symbols'
import { fmt, fmtBig } from '../lib/candles'
import type { Fundamentals as F } from '../types'
import Financials from './Financials'
import KapNews from './KapNews'
import { companyDataReady } from '../lib/company'

type Kind = 'num' | 'pct' | 'big' | 'signed' | 'rating'
const SECTIONS: [string, [string, string, Kind][]][] = [
  ['Değerleme', [['price_earnings_ttm', 'F/K', 'num'], ['price_book_fq', 'PD/DD', 'num'], ['enterprise_value_ebitda_ttm', 'FD/FAVÖK', 'num'], ['price_sales_current', 'F/Satış', 'num'],
    ['price_earnings_growth_ttm', 'PEG', 'num'], ['price_free_cash_flow_ttm', 'F/Serbest Nakit Akışı', 'num'], ['market_cap_basic', 'Piyasa Değeri (₺)', 'big'], ['enterprise_value_fq', 'Firma Değeri (₺)', 'big'], ['dividends_yield_current', 'Temettü Verimi', 'pct']]],
  ['Kârlılık', [['gross_margin', 'Brüt Marj', 'pct'], ['operating_margin', 'Faaliyet Marjı', 'pct'], ['net_margin', 'Net Marj', 'pct'], ['return_on_equity', 'Özkaynak Kârlılığı', 'pct'], ['return_on_assets', 'Aktif Kârlılığı', 'pct'],
    ['earnings_per_share_basic_ttm', 'Hisse Başı Kâr (₺)', 'num'], ['total_revenue', 'Gelir (₺)', 'big'], ['ebitda', 'FAVÖK (₺)', 'big'], ['net_income', 'Net Kâr (₺)', 'big'], ['free_cash_flow', 'Serbest Nakit Akışı (₺)', 'big']]],
  ['Büyüme (yıllık)', [['total_revenue_yoy_growth_ttm', 'Gelir Büyümesi', 'signed'], ['earnings_per_share_diluted_yoy_growth_ttm', 'Hisse Başı Kâr Büyümesi', 'signed']]],
  ['Bilanço Özeti', [['total_assets', 'Toplam Varlıklar (₺)', 'big'], ['total_equity_fq', 'Özkaynaklar (₺)', 'big'], ['total_debt', 'Toplam Borç (₺)', 'big'], ['debt_to_equity', 'Borç/Özkaynak', 'num'], ['current_ratio', 'Cari Oran', 'num'], ['quick_ratio', 'Likidite Oranı', 'num']]],
  ['Performans', [['change', 'Günlük', 'signed'], ['Perf.W', 'Haftalık', 'signed'], ['Perf.1M', 'Aylık', 'signed'], ['Perf.YTD', 'Yılbaşından', 'signed'], ['Perf.Y', 'Yıllık', 'signed']]],
  ['Hisse ve Teknik', [['total_shares_outstanding', 'Toplam Hisse', 'big'], ['free_float', 'Halka Açıklık', 'pct'], ['beta_1_year', 'Beta (1 yıl)', 'num'], ['Volatility.M', 'Aylık Oynaklık', 'pct'], ['RSI', 'RSI(14)', 'num'],
    ['volume', 'Hacim (lot)', 'big'], ['average_volume_30d_calc', 'Ort. Hacim (30g)', 'big'], ['relative_volume_10d_calc', 'Göreli Hacim (10g)', 'num'], ['Recommend.All', 'Teknik Görünüm', 'rating']]],
]
const rating = (v: number) => (v > 0.5 ? 'Güçlü Al' : v > 0.1 ? 'Al' : v >= -0.1 ? 'Nötr' : v >= -0.5 ? 'Sat' : 'Güçlü Sat')

const show = (v: number | null | undefined, k: Kind) =>
  v == null ? '—' : k === 'rating' ? rating(v) : k === 'big' ? fmtBig(v) : k === 'pct' ? `%${fmt(v, 2)}` : k === 'signed' ? `${v >= 0 ? '+' : ''}${fmt(v, 2)}%` : fmt(v, 2)

type Tab = 'sum' | 'fin' | 'kap'
const TABS: [Tab, string][] = [['sum', 'Özet'], ['fin', 'Mali Tablolar'], ['kap', 'KAP Haberleri']]

/** BIST hisseleri için özet oranlar, mali tablolar ve KAP bildirimleri. */
export default function Fundamentals() {
  const symbol = useApp((s) => s.panes[s.active])
  const info = getSymbol(symbol)
  const ok = info.category === 'BIST' && !isIndex(symbol)
  const [tab, setTab] = useState<Tab>('sum')
  if (!ok) return <p className="p-3 text-xs text-mute">Temel analiz yalnızca BIST hisseleri için gösterilir.</p>
  return (
    <div>
      <div className="flex border-b border-line">
        {TABS.map(([k, l]) => <button key={k} className={`tab flex-1 px-1 ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab !== 'sum' && !companyDataReady() ? <p className="p-3 text-xs text-mute">Bu bölüm için veri sunucusu (Worker) gerekli.</p>
        : tab === 'sum' ? <Summary symbol={symbol} /> : tab === 'fin' ? <Financials symbol={symbol} /> : <KapNews symbol={symbol} />}
    </div>
  )
}

function Summary({ symbol }: { symbol: string }) {
  const info = getSymbol(symbol)
  const ok = true
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
  if (err) return <p className="p-3 text-xs text-down">Temel veriler alınamadı.</p>
  if (!data) return <p className="p-3 text-xs text-mute">Yükleniyor…</p>
  const range = data.high52 && data.low52 && data.price ? ((data.price - data.low52) / (data.high52 - data.low52)) * 100 : undefined
  const base = data.stats ?? { price_earnings_ttm: data.pe ?? null, price_book_fq: data.pb ?? null, market_cap_basic: data.marketCap ?? null }
  const [float, shares] = [base.float_shares_outstanding, base.total_shares_outstanding]
  const st: Record<string, number | null | undefined> = { ...base, free_float: float && shares ? (float / shares) * 100 : null }
  const groups = indicesOf(symbol)
  return (
    <div className="p-3 text-xs space-y-3">
      <div>
        <h3 className="text-sm font-semibold">{displayName(symbol)} <span className="tabular-nums font-normal">{fmt(data.price)} {data.currency}</span></h3>
        <p className="text-mute">{info.name}</p>
        <p className="text-mute">{info.sector}</p>
      </div>
      {range !== undefined && (
        <div>
          <div className="flex justify-between text-mute mb-1"><span>{fmt(data.low52)}</span><span>52 Haftalık Aralık</span><span>{fmt(data.high52)}</span></div>
          <div className="h-1.5 bg-line rounded relative">
            <div className="absolute -top-1 w-1 h-3.5 bg-acc rounded" style={{ left: `${Math.min(100, Math.max(0, range))}%` }} />
          </div>
        </div>
      )}
      {SECTIONS.map(([title, rows]) => (
        <section key={title}>
          <h4 className="font-semibold text-mute uppercase text-[10px] tracking-wide mb-1">{title}</h4>
          <dl className="divide-y divide-line">
            {rows.map(([k, label, kind]) => {
              const v = st[k]
              const color = kind === 'signed' && v != null ? (v >= 0 ? 'text-up' : 'text-down') : ''
              return <div key={k} className="flex justify-between py-1"><dt className="text-mute">{label}</dt><dd className={`tabular-nums ${color}`}>{show(v, kind)}</dd></div>
            })}
          </dl>
        </section>
      ))}
      {groups.length > 0 && (
        <section>
          <h4 className="font-semibold text-mute uppercase text-[10px] tracking-wide mb-1">Dahil Olduğu Endeksler</h4>
          <div className="flex flex-wrap gap-1">{groups.map((g) => <span key={g} className="border border-line rounded px-1.5 py-0.5 text-[10px]">{g}</span>)}</div>
        </section>
      )}
    </div>
  )
}
