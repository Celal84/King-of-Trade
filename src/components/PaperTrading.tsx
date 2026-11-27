import { useState } from 'react'
import { X } from 'lucide-react'
import { useApp } from '../store/app'
import { usePaper, walletOf, type Side } from '../store/paper'
import { displayName } from '../data/symbols'
import { fmt } from '../lib/candles'

export default function PaperTrading() {
  const symbol = useApp((s) => s.panes[s.active])
  const prices = useApp((s) => s.prices)
  const p = usePaper()
  const [side, setSide] = useState<Side>('buy')
  const [type, setType] = useState<'market' | 'limit'>('market')
  const [qty, setQty] = useState('')
  const [limit, setLimit] = useState('')
  const [msg, setMsg] = useState('')
  const w = walletOf(symbol)
  const last = prices[symbol]?.price
  const submit = () => {
    const q = parseFloat(qty.replace(',', '.'))
    const lp = parseFloat(limit.replace(',', '.'))
    if (!(q > 0)) return setMsg('Geçerli miktar girin')
    if (type === 'market' && !last) return setMsg('Fiyat bekleniyor')
    if (type === 'limit' && !(lp > 0)) return setMsg('Geçerli limit fiyatı girin')
    const err = type === 'market' ? p.market(symbol, side, q, last!) : p.limit(symbol, side, q, lp)
    setMsg(err ?? 'Emir iletildi ✓')
    if (!err) setQty('')
  }
  const positions = Object.entries(p.positions)
  return (
    <div className="p-2 text-xs space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(['TRY', 'USDT'] as const).map((k) => (
          <div key={k} className={`rounded border p-2 ${w === k ? 'border-acc' : 'border-line'}`}>
            <div className="text-mute">{k === 'TRY' ? 'TL Cüzdan' : 'USD Cüzdan'}</div>
            <div className="font-semibold tabular-nums">{fmt(p.cash[k], 2)}</div>
          </div>
        ))}
      </div>
      <div className="rounded border border-line p-2 space-y-2">
        <div className="flex justify-between"><span className="font-semibold">{displayName(symbol)}</span><span className="tabular-nums">{fmt(last)} {w}</span></div>
        <div className="grid grid-cols-2 gap-1">
          <button className={`btn justify-center ${side === 'buy' ? 'bg-up text-white' : 'border border-line'}`} onClick={() => setSide('buy')}>Al</button>
          <button className={`btn justify-center ${side === 'sell' ? 'bg-down text-white' : 'border border-line'}`} onClick={() => setSide('sell')}>Sat</button>
        </div>
        <div className="flex gap-1">
          {(['market', 'limit'] as const).map((t) => <button key={t} className={`btn ${type === t ? 'btn-on' : ''}`} onClick={() => setType(t)}>{t === 'market' ? 'Piyasa' : 'Limit'}</button>)}
        </div>
        <input className="inp" inputMode="decimal" placeholder="Miktar" value={qty} onChange={(e) => setQty(e.target.value)} />
        {type === 'limit' && <input className="inp" inputMode="decimal" placeholder="Limit fiyat" value={limit} onChange={(e) => setLimit(e.target.value)} />}
        <button className={`btn w-full justify-center text-white ${side === 'buy' ? 'bg-up' : 'bg-down'}`} onClick={submit}>{side === 'buy' ? 'Alış Emri' : 'Satış Emri'}</button>
        {msg && <p className="text-mute">{msg}</p>}
      </div>
      <section>
        <h4 className="font-semibold mb-1">Pozisyonlar</h4>
        {positions.length === 0 && <p className="text-mute">Açık pozisyon yok</p>}
        {positions.map(([s, pos]) => {
          const cur = prices[s]?.price
          const pnl = cur !== undefined ? (cur - pos.avg) * pos.qty : undefined
          return (
            <div key={s} className="flex justify-between py-1 border-b border-line">
              <span>{displayName(s)} · {fmt(pos.qty, 4)} @ {fmt(pos.avg)}</span>
              <span className={`tabular-nums ${(pnl ?? 0) >= 0 ? 'text-up' : 'text-down'}`}>{fmt(pnl, 2)} {walletOf(s)}</span>
            </div>
          )
        })}
      </section>
      {p.orders.length > 0 && (
        <section>
          <h4 className="font-semibold mb-1">Bekleyen Emirler</h4>
          {p.orders.map((o) => (
            <div key={o.id} className="flex justify-between items-center py-1 border-b border-line">
              <span className={o.side === 'buy' ? 'text-up' : 'text-down'}>{o.side === 'buy' ? 'AL' : 'SAT'} {displayName(o.symbol)} {fmt(o.qty, 4)} @ {fmt(o.price)}</span>
              <button onClick={() => p.cancel(o.id)} aria-label="İptal"><X size={14} /></button>
            </div>
          ))}
        </section>
      )}
      <section>
        <h4 className="font-semibold mb-1">İşlem Geçmişi</h4>
        {p.history.length === 0 && <p className="text-mute">İşlem yok</p>}
        {p.history.slice(0, 50).map((t) => (
          <div key={t.id} className="flex justify-between py-1 border-b border-line">
            <span><span className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.side === 'buy' ? 'AL' : 'SAT'}</span> {displayName(t.symbol)} {fmt(t.qty, 4)} @ {fmt(t.price)} <span className="text-mute">{t.kind}</span></span>
            <span className="text-mute">{t.pnl !== undefined ? <b className={t.pnl >= 0 ? 'text-up' : 'text-down'}>{fmt(t.pnl, 2)}</b> : new Date(t.time).toLocaleDateString('tr-TR')}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
