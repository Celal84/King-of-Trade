import { useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import { useApp } from '../store/app'
import { paneApis } from '../lib/chartRegistry'
import { displayName } from '../data/symbols'
import { fmt } from '../lib/candles'
import { OP_LABEL, SERIES_LABEL, hasParam, reverse, runBacktest, type Operand, type Result, type Rule, type RuleOp, type SeriesType } from '../lib/backtest'

const DEFAULT_ENTRY: Rule = { a: { type: 'ema', n: 20 }, op: '>', b: { type: 'ema', n: 50 } }
const DEFAULT_N: Record<SeriesType, number> = { close: 0, ema: 20, sma: 50, rsi: 14, macd: 0, signal: 0, const: 30 }
const pct = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}%`
const date = (t: number) => new Date(t).toLocaleDateString('tr-TR')

function OperandInput({ value, onChange }: { value: Operand; onChange: (o: Operand) => void }) {
  return (
    <>
      <select className="inp h-7 text-xs" value={value.type} onChange={(e) => onChange({ type: e.target.value as SeriesType, n: DEFAULT_N[e.target.value as SeriesType] })}>
        {(Object.keys(SERIES_LABEL) as SeriesType[]).map((k) => <option key={k} value={k}>{SERIES_LABEL[k]}</option>)}
      </select>
      {hasParam(value.type) && (
        <input className="inp h-7 text-xs w-14" type="number" step="any" value={Number.isFinite(value.n) ? value.n : ''} onChange={(e) => onChange({ ...value, n: parseFloat(e.target.value) })} />
      )}
    </>
  )
}

function RuleRow({ label, rule, onChange }: { label: string; rule: Rule; onChange: (r: Rule) => void }) {
  return (
    <div className="space-y-1">
      <span className="text-mute">{label}</span>
      <div className="flex gap-1 items-center">
        <OperandInput value={rule.a} onChange={(a) => onChange({ ...rule, a })} />
        <select className="inp h-7 text-xs" value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as RuleOp })}>
          {(Object.keys(OP_LABEL) as RuleOp[]).map((k) => <option key={k} value={k}>{OP_LABEL[k]}</option>)}
        </select>
        <OperandInput value={rule.b} onChange={(b) => onChange({ ...rule, b })} />
      </div>
    </div>
  )
}

export default function StrategyTester() {
  const { panes, active, tf } = useApp()
  const [entry, setEntry] = useState(DEFAULT_ENTRY)
  const [exit, setExit] = useState<Rule | null>(null)
  const [fee, setFee] = useState(0.2)
  const [res, setRes] = useState<Result | null>(null)
  const [msg, setMsg] = useState('')
  const run = () => {
    const api = paneApis.get(active)
    const candles = api?.candles() ?? []
    if (candles.length < 30) return setMsg('Grafik verisi henüz yüklenmedi.')
    const r = runBacktest(candles, { entry, exit, fee: Number.isFinite(fee) ? fee : 0 })
    setMsg('')
    setRes(r)
    api?.markers(r.trades.flatMap((t) => [{ timestamp: t.inAt, price: t.inPrice, buy: true }, ...(t.open ? [] : [{ timestamp: t.outAt, price: t.outPrice, buy: false }])]))
  }
  const clear = () => {
    setRes(null)
    paneApis.get(active)?.markers([])
  }
  const stat = (label: string, value: string, cls = '') => (
    <div className="p-2 rounded border border-line">
      <div className="text-mute text-[10px]">{label}</div>
      <div className={`font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  )
  const tone = (v: number) => (v >= 0 ? 'text-up' : 'text-down')
  return (
    <div className="p-2 space-y-2 text-xs">
      <p className="text-mute">{displayName(panes[active])} · {tf} · yalnızca alım yönlü, işlemler sinyal mumunun kapanışında.</p>
      <RuleRow label="Alış kuralı" rule={entry} onChange={setEntry} />
      <label className="flex items-center gap-1 text-mute">
        <input type="checkbox" checked={exit === null} onChange={(e) => setExit(e.target.checked ? null : reverse(entry))} /> Satış = alış kuralının tersi
      </label>
      {exit && <RuleRow label="Satış kuralı" rule={exit} onChange={setExit} />}
      <div className="flex gap-1 items-center">
        <span className="text-mute">Komisyon %</span>
        <input className="inp h-7 text-xs w-16" type="number" step="any" min="0" value={Number.isFinite(fee) ? fee : ''} onChange={(e) => setFee(parseFloat(e.target.value))} />
        <button className="btn bg-acc text-white px-3 ml-auto" onClick={run}><Play size={13} /> Test Et</button>
        {res && <button className="btn border border-line" onClick={clear} aria-label="Sonuçları temizle"><Trash2 size={13} /></button>}
      </div>
      {msg && <p className="text-down">{msg}</p>}
      {res && (
        <>
          <div className="grid grid-cols-2 gap-1">
            {stat('Toplam getiri', pct(res.total), tone(res.total))}
            {stat('Al-tut getirisi', pct(res.buyHold), tone(res.buyHold))}
            {stat('Kazanma oranı', `${fmt(res.winRate, 1)}%`)}
            {stat('Maksimum düşüş', `-${fmt(res.maxDrawdown, 2)}%`, 'text-down')}
            {stat('İşlem sayısı', String(res.trades.length))}
            {stat('Mum sayısı', String(res.bars))}
          </div>
          <ul className="divide-y divide-line">
            {res.trades.slice(-100).reverse().map((t) => (
              <li key={t.inAt} className="flex justify-between py-1 tabular-nums">
                <span>{date(t.inAt)} → {t.open ? 'açık' : date(t.outAt)}</span>
                <span className="text-mute">{fmt(t.inPrice)} → {fmt(t.outPrice)}</span>
                <span className={tone(t.pnl)}>{pct(t.pnl)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
