import { useState } from 'react'
import { Plus, RotateCcw, Trash2, X } from 'lucide-react'
import Modal from './Modal'
import { alertTf, useAlerts } from '../store/alerts'
import { useApp } from '../store/app'
import { displayName, getSymbol } from '../data/symbols'
import { fmt } from '../lib/candles'
import { ALERT_TFS, COND_LABEL, alertText, type AlertTf, type Cond, type CondKind } from '../lib/alertEval'
import { loadDrawings } from '../lib/drawings'
import { askNotificationPermission } from '../lib/notify'

const PRESET: Partial<Record<CondKind, number>> = { rsi_below: 30, rsi_above: 70, change_above: 5, change_below: -5, ema_above: 50, ema_below: 50, cross_up: 20, cross_down: 20 }
const CLOUD = { off: 'Sunucu tanımlı değil: alarmlar yalnızca uygulama açıkken çalışır.', ok: '☁ Sunucuyla eşitlendi: alarmlar uygulama kapalıyken de Telegram’a gönderilir.', err: '⚠ Sunucuya ulaşılamadı: alarmlar şimdilik yalnızca uygulama açıkken çalışır.' }
const num = (v: string) => parseFloat(v.replace(',', '.'))

export default function AlertsPanel({ onClose }: { onClose: () => void }) {
  const { panes, active, tf, prices } = useApp()
  const symbol = panes[active]
  const price = prices[symbol]?.price
  const { alerts, cloud, add, remove, rearm } = useAlerts()
  const [atf, setAtf] = useState<AlertTf>(alertTf(tf))
  const [op, setOp] = useState<'AND' | 'OR'>('AND')
  const [conds, setConds] = useState<Cond[]>([{ kind: 'price_above', value: price ?? 0 }])
  const lines = loadDrawings(symbol).filter((d) => d.name.startsWith('horizontal') && d.points[0]).map((d) => d.points[0].value)
  const edit = (i: number, p: Partial<Cond>) => setConds(conds.map((c, j) => (j === i ? { ...c, ...p } : c)))
  const onKind = (i: number, kind: CondKind) =>
    edit(i, { kind, value: kind === 'touch' ? (lines[0] ?? price ?? 0) : (PRESET[kind] ?? price ?? 0), ...(kind.startsWith('cross') ? { ma: 'EMA', slow: 50 } : { ma: undefined, slow: undefined }) })
  const valid = conds.every((c) => isFinite(c.value) && (!c.kind.startsWith('cross') || (c.slow ?? 0) > 0))
  const submit = () => {
    if (!valid) return
    askNotificationPermission()
    add({ symbol, tf: atf, op, conds })
  }
  const numInput = (value: number | undefined, on: (v: number) => void, cls = '') => (
    <input className={`inp ${cls}`} inputMode="decimal" defaultValue={value} key={String(value)} onBlur={(e) => on(num(e.target.value))} />
  )
  return (
    <Modal title="Alarmlar" onClose={onClose}>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-mute flex-1">{displayName(symbol)} · Şu an {fmt(price)}</span>
          <select className="inp w-auto" value={atf} title="Zaman dilimi" onChange={(e) => setAtf(e.target.value as AlertTf)}>
            {ALERT_TFS.map((t) => <option key={t}>{t}</option>)}
          </select>
          {conds.length > 1 && (
            <select className="inp w-auto" value={op} onChange={(e) => setOp(e.target.value as 'AND' | 'OR')}>
              <option value="AND">Hepsi (VE)</option>
              <option value="OR">Herhangi biri (VEYA)</option>
            </select>
          )}
        </div>
        {conds.map((c, i) => (
          <div key={i} className="flex gap-1 items-center">
            <select className="inp" value={c.kind} onChange={(e) => onKind(i, e.target.value as CondKind)}>
              {(Object.keys(COND_LABEL) as CondKind[]).map((k) => <option key={k} value={k}>{COND_LABEL[k]}</option>)}
            </select>
            {c.kind.startsWith('cross') && (
              <select className="inp w-auto" value={c.ma} onChange={(e) => edit(i, { ma: e.target.value as 'EMA' | 'SMA' })}>
                <option>EMA</option>
                <option>SMA</option>
              </select>
            )}
            {numInput(c.value, (v) => edit(i, { value: v }), 'w-20')}
            {c.kind.startsWith('cross') && numInput(c.slow, (v) => edit(i, { slow: v }), 'w-16')}
            {c.kind === 'touch' && lines.length > 0 && (
              <select className="inp w-auto" value="" onChange={(e) => edit(i, { value: +e.target.value })}>
                <option value="">Çizgi…</option>
                {lines.map((v, j) => <option key={j} value={v}>{fmt(v)}</option>)}
              </select>
            )}
            {conds.length > 1 && <button onClick={() => setConds(conds.filter((_, j) => j !== i))} aria-label="Koşulu sil"><X size={14} className="text-mute" /></button>}
          </div>
        ))}
        <div className="flex gap-1">
          <button className="btn border border-line" onClick={() => setConds([...conds, { kind: 'rsi_below', value: 30 }])}><Plus size={14} /> Koşul</button>
          <button className="btn bg-acc text-white px-3 ml-auto" disabled={!valid} onClick={submit}>Alarm Ekle</button>
        </div>
        <p className="text-mute">{CLOUD[cloud]} Kesişimde ilk kutu hızlı, ikinci kutu yavaş periyottur.</p>
        <ul className="divide-y divide-line">
          {alerts.length === 0 && <li className="py-2 text-mute">Alarm yok</li>}
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-1.5">
              <span className="flex-1">
                <b>{displayName(a.symbol)}</b> {alertText(a)}
                {a.active ? <span className="text-up ml-1">● aktif</span> : <span className="text-mute ml-1">✓ {new Date(a.triggeredAt ?? 0).toLocaleString('tr-TR')}</span>}
                {getSymbol(a.symbol).source === 'synthetic' && <span className="text-mute ml-1">(yalnızca uygulama açıkken)</span>}
              </span>
              {!a.active && <button onClick={() => rearm(a.id)} aria-label="Yeniden kur" title="Yeniden kur"><RotateCcw size={14} className="text-mute" /></button>}
              <button onClick={() => remove(a.id)} aria-label="Sil"><Trash2 size={14} className="text-down" /></button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
