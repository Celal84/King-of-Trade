import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Modal from './Modal'
import { ALERT_LABEL, useAlerts, type AlertKind } from '../store/alerts'
import { useApp } from '../store/app'
import { displayName } from '../data/symbols'
import { fmt } from '../lib/candles'
import { askNotificationPermission } from '../lib/notify'

export default function AlertsPanel({ onClose }: { onClose: () => void }) {
  const { panes, active, tf, prices } = useApp()
  const symbol = panes[active]
  const { alerts, add, remove } = useAlerts()
  const [kind, setKind] = useState<AlertKind>('price_above')
  const [value, setValue] = useState(() => String(prices[symbol]?.price ?? ''))
  const onKind = (k: AlertKind) => {
    setKind(k)
    setValue(k === 'rsi_below' ? '30' : k === 'rsi_above' ? '70' : String(prices[symbol]?.price ?? ''))
  }
  const submit = () => {
    const v = parseFloat(value.replace(',', '.'))
    if (!isFinite(v)) return
    askNotificationPermission()
    add({ symbol, kind, value: v, tf })
  }
  return (
    <Modal title="Alarmlar" onClose={onClose}>
      <div className="space-y-2 text-xs">
        <p className="text-mute">{displayName(symbol)} · {tf} · Şu an {fmt(prices[symbol]?.price)}</p>
        <div className="flex gap-1">
          <select className="inp" value={kind} onChange={(e) => onKind(e.target.value as AlertKind)}>
            {(Object.keys(ALERT_LABEL) as AlertKind[]).map((k) => <option key={k} value={k}>{ALERT_LABEL[k]}</option>)}
          </select>
          <input className="inp" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn bg-acc text-white px-3" onClick={submit}>Ekle</button>
        </div>
        <p className="text-mute">Tetiklenince sesli uyarı, tarayıcı bildirimi ve (Ayarlar’da tanımlıysa) Telegram mesajı gönderilir.</p>
        <ul className="divide-y divide-line">
          {alerts.length === 0 && <li className="py-2 text-mute">Alarm yok</li>}
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-1.5">
              <span>
                <b>{displayName(a.symbol)}</b> {ALERT_LABEL[a.kind]} {a.value} <span className="text-mute">({a.tf})</span>
                {a.active ? <span className="text-up ml-1">● aktif</span> : <span className="text-mute ml-1">✓ {new Date(a.triggeredAt ?? 0).toLocaleString('tr-TR')}</span>}
              </span>
              <button onClick={() => remove(a.id)} aria-label="Sil"><Trash2 size={14} className="text-down" /></button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
