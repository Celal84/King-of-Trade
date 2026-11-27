import { useMemo, useState } from 'react'
import { BellPlus, Eye, EyeOff, LineChart, Pencil, Plus, Trash2 } from 'lucide-react'
import PaperTrading from './PaperTrading'
import { useApp } from '../store/app'
import { positionsOf, usePortfolio } from '../store/portfolio'
import { displayName, getSymbol } from '../data/symbols'
import { fmt } from '../lib/candles'

const COLORS = ['#b9dc7a', '#2962ff', '#ff9800', '#e040fb', '#26a69a', '#ef5350', '#00bcd4', '#f0b90b', '#935ebd', '#8d99ae']
const R = 52
const LEN = 2 * Math.PI * R
const signed = (v: number, d = 2) => `${v >= 0 ? '+' : ''}${fmt(v, d)}`
const tone = (v: number) => (v >= 0 ? 'text-up' : 'text-down')
const when = (t: number) => new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

function Holdings({ onPick }: { onPick?: () => void }) {
  const { txs, cash, remove, removeSymbol, setCash } = usePortfolio()
  const { prices, setSymbol, set } = useApp()
  const [open, setOpen] = useState<string | null>(null)
  const [hide, setHide] = useState(false)
  const usd = prices['USDTRY=X']?.price ?? 0
  const rows = useMemo(() => positionsOf(txs).map((p) => {
    const q = prices[p.symbol]
    const fx = getSymbol(p.symbol).currency === 'TRY' ? 1 : usd
    const price = q?.price ?? p.avg
    const value = p.qty * price
    return { ...p, price, change: q?.change ?? 0, fx, value, pnl: value - p.cost, day: q ? value - value / (1 + q.change / 100) : 0 }
  }), [txs, prices, usd])
  const held = rows.filter((r) => r.qty > 0).sort((a, b) => b.value * b.fx - a.value * a.fx)
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r) * r.fx, 0)
  const [stock, cost, pnl, day, realized] = [sum((r) => r.value), sum((r) => r.cost), sum((r) => r.pnl), sum((r) => r.day), sum((r) => r.realized)]
  const total = stock + cash
  const money = (v: number, d = 2) => (hide ? '••••' : fmt(v, d))
  const slices = [...held.map((r, i) => ({ label: displayName(r.symbol), v: r.value * r.fx, color: COLORS[i % (COLORS.length - 1)] })), { label: 'Nakit', v: cash, color: '#5d6b82' }].filter((s) => s.v > 0)
  let offset = 0
  const editCash = () => {
    const v = parseFloat((window.prompt('Nakit bakiye (TL):', String(cash)) ?? '').replace(',', '.'))
    if (isFinite(v) && v >= 0) setCash(v)
  }
  return (
    <div className="p-2 space-y-2 text-xs">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0 -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#1f2430" strokeWidth="10" />
          {total > 0 && slices.map((s) => {
            const len = (s.v / total) * LEN
            const el = <circle key={s.label} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="10" strokeDasharray={`${Math.max(0, len - 1.5)} ${LEN}`} strokeDashoffset={-offset} />
            offset += len
            return el
          })}
        </svg>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1 text-mute">Toplam Değer
            <button className="ml-auto" onClick={() => setHide(!hide)} aria-label={hide ? 'Tutarları göster' : 'Tutarları gizle'}>{hide ? <EyeOff size={14} /> : <Eye size={14} />}</button>
          </div>
          <div className="text-lg font-semibold tabular-nums">{money(total)} ₺</div>
          <div className="flex justify-between"><span className="text-mute">Pot. K/Z</span><span className={`tabular-nums ${tone(pnl)}`}>{hide ? '••••' : signed(pnl)} ₺ ({signed(cost ? (pnl / cost) * 100 : 0)}%)</span></div>
          <div className="flex justify-between"><span className="text-mute">Günlük K/Z</span><span className={`tabular-nums ${tone(day)}`}>{hide ? '••••' : signed(day)} ₺</span></div>
          <div className="flex justify-between"><span className="text-mute">Gerçekleşen K/Z</span><span className={`tabular-nums ${tone(realized)}`}>{hide ? '••••' : signed(realized)} ₺</span></div>
        </div>
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {slices.map((s) => <span key={s.label} className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label} {fmt((s.v / total) * 100, 1)}%</span>)}
        </div>
      )}
      <div className="flex items-center gap-2 px-2 h-8 rounded bg-line/40 border-l-4 border-acc">
        <span className="flex-1">Nakit</span><span className="tabular-nums">{money(cash)} ₺</span>
        <button onClick={editCash} aria-label="Nakit bakiyeyi düzenle"><Pencil size={12} className="text-mute" /></button>
      </div>
      <div className="flex items-center gap-2 px-2 h-8 rounded bg-line/40 border-l-4 border-[#b9dc7a]">
        <span className="flex-1">Varlıklar ({held.length})</span><span className="tabular-nums">{money(stock)} ₺</span>
        <button className="btn h-6 bg-acc text-white" onClick={() => set({ txForm: {} })}><Plus size={13} /> İşlem ekle</button>
      </div>
      {held.length === 0 && <p className="text-mute p-2">Portföy boş. “İşlem ekle” ile istediğiniz hisseyi, maliyet, miktar ve tarih girerek ekleyin.</p>}
      <ul className="divide-y divide-line">
        {held.map((r) => (
          <li key={r.symbol}>
            <div className="flex items-center gap-2 py-1.5 cursor-pointer" onClick={() => setOpen(open === r.symbol ? null : r.symbol)}>
              <div className="w-[30%] min-w-0">
                <div className="font-semibold text-sm">{displayName(r.symbol)}</div>
                <div className="tabular-nums">{fmt(r.price)} <span className={tone(r.change)}>{signed(r.change)}%</span></div>
              </div>
              <div className="flex-1 tabular-nums">
                <div><b>{hide ? '••' : fmt(r.qty, r.qty % 1 ? 4 : 0)}</b> <span className="text-mute">adet</span></div>
                <div><span className="text-mute">Maliyet:</span> {fmt(r.avg)}</div>
              </div>
              <div className="text-right tabular-nums">
                <div className="font-semibold">{money(r.value)} {r.fx === 1 ? '₺' : '$'}</div>
                <div className={tone(r.pnl)}>{hide ? '••••' : signed(r.pnl)} {signed(r.cost ? (r.pnl / r.cost) * 100 : 0)}%</div>
              </div>
            </div>
            {open === r.symbol && (
              <div className="pb-2 space-y-1">
                <div className="flex flex-wrap gap-1">
                  <button className="btn h-7 border border-up text-up" onClick={() => set({ txForm: { symbol: r.symbol, side: 'buy' } })}>Ekle</button>
                  <button className="btn h-7 border border-down text-down" onClick={() => set({ txForm: { symbol: r.symbol, side: 'sell' } })}>Çıkar</button>
                  <button className="btn h-7 border border-line" onClick={() => (setSymbol(r.symbol), onPick?.())}><LineChart size={13} /> Grafik</button>
                  <button className="btn h-7 border border-line" onClick={() => set({ alertSymbol: r.symbol })}><BellPlus size={13} /> Alarm</button>
                  <button className="btn h-7 text-down ml-auto" aria-label="Pozisyonu tüm işlemleriyle sil" onClick={() => confirm(`${displayName(r.symbol)} pozisyonu ve tüm işlemleri silinsin mi?`) && removeSymbol(r.symbol)}><Trash2 size={13} /></button>
                </div>
                <ul className="text-[11px] text-mute">
                  {txs.filter((t) => t.symbol === r.symbol).map((t) => (
                    <li key={t.id} className="flex items-center gap-2 py-0.5">
                      <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.side === 'buy' ? 'Alış' : 'Satış'}</span>
                      <span className="tabular-nums">{fmt(t.qty, t.qty % 1 ? 4 : 0)} × {fmt(t.price)}</span>
                      <span className="flex-1 truncate">{when(t.date)}{t.note ? ` · ${t.note}` : ''}</span>
                      <button aria-label="İşlemi düzenle" onClick={() => set({ txForm: { id: t.id, symbol: t.symbol } })}><Pencil size={11} /></button>
                      <button aria-label="İşlemi sil" onClick={() => remove(t.id)}><Trash2 size={11} className="text-down" /></button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Portfolio({ onPick }: { onPick?: () => void }) {
  const [mode, setMode] = useState<'real' | 'paper'>('real')
  return (
    <div>
      <div className="flex border-b border-line">
        <button className={`tab flex-1 ${mode === 'real' ? 'tab-on' : ''}`} onClick={() => setMode('real')}>Portföyüm</button>
        <button className={`tab flex-1 ${mode === 'paper' ? 'tab-on' : ''}`} onClick={() => setMode('paper')}>Sanal İşlem</button>
      </div>
      {mode === 'real' ? <Holdings onPick={onPick} /> : <PaperTrading />}
    </div>
  )
}
