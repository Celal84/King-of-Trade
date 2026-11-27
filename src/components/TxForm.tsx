import { useState } from 'react'
import { Search } from 'lucide-react'
import Modal from './Modal'
import SymbolSearch from './SymbolSearch'
import { useApp, type TxDraft } from '../store/app'
import { positionsOf, usePortfolio } from '../store/portfolio'
import { displayName, getSymbol } from '../data/symbols'
import { fmt } from '../lib/candles'

const localInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const num = (v: string) => parseFloat(v.replace(',', '.'))

/** Portföye alış/satış işlemi ekler veya var olan işlemi düzenler. */
export default function TxForm({ draft, onClose }: { draft: TxDraft; onClose: () => void }) {
  const { txs, save } = usePortfolio()
  const prices = useApp((s) => s.prices)
  const editing = txs.find((t) => t.id === draft.id)
  const [symbol, setSymbol] = useState(editing?.symbol ?? draft.symbol ?? '')
  const [side, setSide] = useState<'buy' | 'sell'>(editing?.side ?? draft.side ?? 'buy')
  const [qty, setQty] = useState(editing ? String(editing.qty) : '')
  const [price, setPrice] = useState(editing ? String(editing.price) : String(prices[draft.symbol ?? '']?.price ?? ''))
  const [date, setDate] = useState(localInput(editing?.date ?? Date.now()))
  const [note, setNote] = useState(editing?.note ?? '')
  const [picking, setPicking] = useState(!symbol)
  const [msg, setMsg] = useState('')
  const held = positionsOf(txs.filter((t) => t.id !== draft.id)).find((p) => p.symbol === symbol)?.qty ?? 0
  const [q, p] = [num(qty), num(price)]
  const pick = (s: string) => {
    setSymbol(s)
    if (!price) setPrice(String(prices[s]?.price ?? ''))
  }
  const submit = () => {
    if (!symbol) return setMsg('Sembol seçin')
    if (!(q > 0) || !(p > 0)) return setMsg('Geçerli miktar ve fiyat girin')
    if (side === 'sell' && q > held + 1e-9) return setMsg(`Elinizde ${fmt(held, 2)} adet var; daha fazlası çıkarılamaz`)
    const when = new Date(date).getTime()
    save({ id: draft.id, symbol, side, qty: q, price: p, date: isFinite(when) ? when : Date.now(), note: note.trim() || undefined })
    onClose()
  }
  if (picking) return <SymbolSearch onPick={pick} onClose={() => (symbol ? setPicking(false) : onClose())} />
  return (
    <Modal title={editing ? 'İşlemi düzenle' : 'Portföye işlem ekle'} onClose={onClose}>
      <div className="space-y-2 text-xs">
        <button className="btn border border-line w-full justify-start" onClick={() => setPicking(true)}>
          <Search size={14} /> <b>{displayName(symbol)}</b> <span className="text-mute truncate">{getSymbol(symbol).name}</span>
          <span className="ml-auto tabular-nums">{fmt(prices[symbol]?.price)}</span>
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button className={`btn justify-center border ${side === 'buy' ? 'border-up text-up bg-up/10' : 'border-line'}`} onClick={() => setSide('buy')}>Alış (ekle)</button>
          <button className={`btn justify-center border ${side === 'sell' ? 'border-down text-down bg-down/10' : 'border-line'}`} onClick={() => setSide('sell')}>Satış (çıkar)</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-mute">Miktar (adet)</span><input className="inp" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></label>
          <label className="space-y-1"><span className="text-mute">{side === 'buy' ? 'Maliyet (birim fiyat)' : 'Satış fiyatı'}</span><input className="inp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
        </div>
        <label className="block space-y-1"><span className="text-mute">Tarih ve saat</span><input className="inp" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="block space-y-1"><span className="text-mute">Not (isteğe bağlı)</span><input className="inp" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <p className="text-mute">Tutar: <b className="text-txt tabular-nums">{q > 0 && p > 0 ? fmt(q * p, 2) : '—'}</b> {getSymbol(symbol).currency} · Eldeki: {fmt(held, 2)} adet</p>
        {msg && <p className="text-down">{msg}</p>}
        <div className="flex gap-1 justify-end pt-1">
          <button className="btn border border-line" onClick={onClose}>İptal</button>
          <button className="btn bg-acc text-white px-4" onClick={submit}>Kaydet</button>
        </div>
      </div>
    </Modal>
  )
}
