import { useEffect, useState } from 'react'
import { getFinancials, type Financials as F } from '../lib/company'
import { fmtBig } from '../lib/candles'

const TABLES: [string, string, string[]][] = [['bs', 'Bilanço', ['1', '2']], ['is', 'Gelir Tablosu', ['3']], ['cf', 'Nakit Akışı', ['4']]]
const label = (p: string) => p.replace('-', '/')

/** İş Yatırım kaynaklı mali tablolar: son dört çeyrek veya son dört yıl. */
export default function Financials({ symbol }: { symbol: string }) {
  const [annual, setAnnual] = useState(false)
  const [table, setTable] = useState('bs')
  const [all, setAll] = useState(false)
  const [data, setData] = useState<F | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let alive = true
    setData(null)
    setErr('')
    getFinancials(symbol, annual).then((d) => alive && setData(d), (e: unknown) => alive && setErr(e instanceof Error ? e.message : 'Hata'))
    return () => {
      alive = false
    }
  }, [symbol, annual])
  const prefixes = TABLES.find(([k]) => k === table)?.[2] ?? []
  const rows = (data?.rows ?? []).filter((r) => prefixes.includes(r.code[0]) && (all || r.code.length <= 3) && r.values.some((v) => v))
  return (
    <div className="p-2 text-xs space-y-2">
      <div className="flex gap-1 flex-wrap">
        {TABLES.map(([k, l]) => <button key={k} className={`btn h-7 border border-line ${table === k ? 'btn-on' : ''}`} onClick={() => setTable(k)}>{l}</button>)}
        <select className="inp h-7 w-auto ml-auto" value={annual ? '1' : '0'} aria-label="Dönem" onChange={(e) => setAnnual(e.target.value === '1')}>
          <option value="0">Çeyreklik</option>
          <option value="1">Yıllık</option>
        </select>
      </div>
      {err && <p className="text-down">Mali tablolar alınamadı ({err}).</p>}
      {!data && !err && <p className="text-mute">Yükleniyor…</p>}
      {data && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full tabular-nums">
              <thead><tr className="text-mute text-[10px]"><th className="text-left font-normal py-1">TL{table === 'is' || table === 'cf' ? ' · yıl başından kümülatif' : ''}</th>{data.periods.map((p) => <th key={p} className="text-right font-normal pl-2">{label(p)}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-t border-line/60">
                    <td className={`py-1 pr-1 ${r.code.length <= 2 ? 'font-semibold' : 'text-mute'}`} style={{ paddingLeft: Math.max(0, r.code.length - 2) * 8 }}>{r.label.trim()}</td>
                    {r.values.map((v, i) => <td key={i} className={`text-right pl-2 whitespace-nowrap ${v !== null && v < 0 ? 'text-down' : ''}`}>{v === null ? '—' : fmtBig(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <p className="text-mute">Bu tablo için veri yok.</p>}
          <label className="flex items-center gap-1 text-mute"><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Tüm alt kalemleri göster</label>
          <p className="text-[10px] text-mute">Kaynak: İş Yatırım mali tablo verisi.</p>
        </>
      )}
    </div>
  )
}
