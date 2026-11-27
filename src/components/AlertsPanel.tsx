import { useState } from 'react'
import { Plus, Repeat, RotateCcw, Trash2 } from 'lucide-react'
import Modal from './Modal'
import AlertForm from './AlertForm'
import { useAlerts } from '../store/alerts'
import { useApp } from '../store/app'
import { displayName } from '../data/symbols'
import { alertText, type Alert } from '../lib/alertEval'

const CLOUD = { off: 'Sunucu tanımlı değil: alarmlar yalnızca uygulama açıkken çalışır.', ok: '☁ Sunucuyla eşitlendi: alarmlar uygulama kapalıyken de Telegram’a gönderilir.', err: '⚠ Sunucuya ulaşılamadı: alarmlar şimdilik yalnızca uygulama açıkken çalışır.' }
const when = (t?: number) => (t ? new Date(t).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '')

/** symbol verilirse pencere doğrudan o sembol için alarm oluşturma formuyla açılır. */
export default function AlertsPanel({ onClose, symbol }: { onClose: () => void; symbol?: string }) {
  const current = useApp((s) => s.panes[s.active])
  const { alerts, cloud, remove, rearm } = useAlerts()
  const [form, setForm] = useState<{ symbol: string; initial?: Alert } | null>(symbol ? { symbol } : null)
  const status = (a: Alert) => {
    if (a.expires && Date.now() > a.expires) return <span className="text-mute">süresi doldu</span>
    if (a.active) return <span className="text-up">● aktif{a.triggeredAt ? ` · son ${when(a.triggeredAt)}` : ''}</span>
    return <span className="text-mute">✓ {when(a.triggeredAt)}</span>
  }
  if (form) {
    return (
      <Modal title={form.initial ? 'Alarmı düzenle' : 'Alarm oluştur'} onClose={onClose}>
        <AlertForm symbol={form.symbol} initial={form.initial} onDone={() => (symbol ? onClose() : setForm(null))} />
      </Modal>
    )
  }
  return (
    <Modal title="Alarmlar" onClose={onClose}>
      <div className="space-y-2 text-xs">
        <button className="btn bg-acc text-white w-full justify-center" onClick={() => setForm({ symbol: current })}><Plus size={14} /> Alarm oluştur ({displayName(current)})</button>
        <p className="text-mute">{CLOUD[cloud]}</p>
        <ul className="divide-y divide-line">
          {alerts.length === 0 && <li className="py-2 text-mute">Alarm yok</li>}
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 py-1.5">
              <button className="flex-1 text-left min-w-0" title="Düzenle" onClick={() => setForm({ symbol: a.symbol, initial: a })}>
                <div className="truncate"><b>{displayName(a.symbol)}</b> {a.message || alertText(a)}</div>
                <div className="flex items-center gap-2 text-[10px]">
                  {status(a)}
                  {a.repeat && <span className="text-mute flex items-center gap-0.5"><Repeat size={10} /> her seferinde</span>}
                  {a.expires && a.active && <span className="text-mute">bitiş {when(a.expires)}</span>}
                </div>
              </button>
              {!a.active && <button onClick={() => rearm(a.id)} aria-label="Yeniden kur" title="Yeniden kur"><RotateCcw size={14} className="text-mute" /></button>}
              <button onClick={() => remove(a.id)} aria-label="Sil"><Trash2 size={14} className="text-down" /></button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
