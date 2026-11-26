import { Plus, Save, Trash2, X } from 'lucide-react'
import { useApp, type ScanOp, type ScanRule } from '../store/app'

type Fmt = 'pct' | 'big' | 'num'
export const METRICS: [string, string, Fmt][] = [
  ['change', 'Günlük %', 'pct'], ['Perf.W', 'Haftalık %', 'pct'], ['Perf.1M', 'Aylık %', 'pct'], ['Perf.YTD', 'Yılbaşından %', 'pct'], ['Perf.Y', 'Yıllık %', 'pct'],
  ['volume', 'Hacim (lot)', 'big'], ['relative_volume_10d_calc', 'Göreli Hacim', 'num'], ['market_cap_basic', 'Piyasa Değeri', 'big'],
  ['price_earnings_ttm', 'F/K', 'num'], ['price_book_fq', 'PD/DD', 'num'], ['dividends_yield_current', 'Temettü Verimi %', 'num'],
  ['RSI', 'RSI(14)', 'num'], ['return_on_equity', 'Özkaynak Kârlılığı %', 'num'], ['debt_to_equity', 'Borç/Özkaynak', 'num'],
]

const FIELDS: [string, string][] = [['close', 'Fiyat'], ...METRICS.map(([k, l]) => [k, l] as [string, string])]
const OPS: ScanOp[] = ['<', '>', '<=', '>=']
const TEST: Record<ScanOp, (a: number, b: number) => boolean> = { '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b }

/** Satır tüm kurallardan geçiyor mu (kurallar VE ile birleşir; verisi olmayan alan elenir). */
export function passes(cols: string[], row: (number | null)[], rules: ScanRule[]): boolean {
  return rules.every((r) => {
    const v = row[cols.indexOf(r.field)]
    return v != null && isFinite(r.value) && TEST[r.op](v, r.value)
  })
}

export default function ScreenerFilters({ rules, onChange }: { rules: ScanRule[]; onChange: (r: ScanRule[]) => void }) {
  const { scans, saveScan, removeScan } = useApp()
  const edit = (i: number, p: Partial<ScanRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const save = () => {
    const name = prompt('Filtre adı')?.trim()
    if (name) saveScan({ name, rules })
  }
  const current = scans.find((s) => JSON.stringify(s.rules) === JSON.stringify(rules))?.name ?? ''
  return (
    <div className="space-y-1">
      {rules.map((r, i) => (
        <div key={i} className="flex gap-1 items-center">
          <select className="inp h-7 text-xs" value={r.field} onChange={(e) => edit(i, { field: e.target.value })}>
            {FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select className="inp h-7 text-xs w-14" value={r.op} onChange={(e) => edit(i, { op: e.target.value as ScanOp })}>
            {OPS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <input className="inp h-7 text-xs w-20" type="number" step="any" value={Number.isFinite(r.value) ? r.value : ''} onChange={(e) => edit(i, { value: parseFloat(e.target.value) })} />
          <button onClick={() => onChange(rules.filter((_, j) => j !== i))} aria-label="Filtreyi sil"><X size={14} className="text-mute" /></button>
        </div>
      ))}
      <div className="flex gap-1 items-center">
        <button className="btn h-6 border border-line" onClick={() => onChange([...rules, { field: 'price_earnings_ttm', op: '<', value: 10 }])}><Plus size={12} /> Filtre</button>
        {rules.length > 0 && <button className="btn h-6 border border-line" onClick={save}><Save size={12} /> Kaydet</button>}
        {scans.length > 0 && (
          <select className="inp h-6 text-xs w-auto ml-auto" value={current} onChange={(e) => onChange(scans.find((s) => s.name === e.target.value)?.rules ?? [])}>
            <option value="">Kayıtlı filtre…</option>
            {scans.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
        )}
        {current && <button onClick={() => removeScan(current)} aria-label="Kayıtlı filtreyi sil"><Trash2 size={13} className="text-down" /></button>}
      </div>
    </div>
  )
}
