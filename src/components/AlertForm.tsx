import { useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import SymbolSearch from './SymbolSearch'
import { alertTf, useAlerts } from '../store/alerts'
import { useApp } from '../store/app'
import { displayName, getSymbol } from '../data/symbols'
import { fmt } from '../lib/candles'
import { ALERT_TFS, OP_LABEL, SRC_LABEL, alertText, kindOf, opsFor, shapeOf, type Alert, type AlertTf, type Cond, type Op, type Rhs, type Src } from '../lib/alertEval'
import { loadDrawings } from '../lib/drawings'
import { askNotificationPermission } from '../lib/notify'

const MONTH = 30 * 86_400_000
const localInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
const num = (v: string) => parseFloat(v.replace(',', '.'))

/** Alarm oluşturma / düzenleme formu. */
export default function AlertForm({ symbol: first, initial, onDone }: { symbol: string; initial?: Alert; onDone: () => void }) {
  const { tf, prices, settings } = useApp()
  const { add, update } = useAlerts()
  const [symbol, setSymbol] = useState(initial?.symbol ?? first)
  const price = prices[symbol]?.price
  const [picking, setPicking] = useState(false)
  const [atf, setAtf] = useState<AlertTf>(initial?.tf ?? alertTf(tf))
  const [op, setOp] = useState<'AND' | 'OR'>(initial?.op ?? 'AND')
  const [conds, setConds] = useState<Cond[]>(initial?.conds ?? [{ kind: 'touch', value: price ?? 0 }])
  const [repeat, setRepeat] = useState(!!initial?.repeat)
  const [limited, setLimited] = useState(initial ? !!initial.expires : true)
  const [expires, setExpires] = useState(localInput(initial?.expires ?? Date.now() + MONTH))
  const [message, setMessage] = useState(initial?.message ?? '')
  const [app, setApp] = useState(initial?.notify?.app !== false)
  const [tg, setTg] = useState(initial?.notify?.tg !== false)
  const lines = loadDrawings(symbol).filter((d) => d.name.startsWith('horizontal') && d.points[0]).map((d) => d.points[0].value)
  const edit = (i: number, p: Partial<Cond>) => setConds(conds.map((c, j) => (j === i ? { ...c, ...p } : c)))
  /** Kaynak, işlem veya karşı taraf değişince koşul türü ve uygun varsayılan değerler yeniden kurulur. */
  const reshape = (i: number, next: { src?: Src; op?: Op; rhs?: Rhs }) => {
    const cur = shapeOf(conds[i].kind)
    const src = next.src ?? cur.src
    const rhs = src === 'price' ? (next.rhs ?? cur.rhs) : 'value'
    const kind = kindOf(src, next.op ?? cur.op, rhs)
    const changed = src !== cur.src || rhs !== cur.rhs
    const value = !changed ? conds[i].value : src === 'ma' ? 20 : rhs === 'ema' ? 50 : src === 'rsi' ? 30 : src === 'change' ? 5 : (price ?? 0)
    edit(i, { kind, value, ...(src === 'ma' ? { ma: conds[i].ma ?? 'EMA', slow: conds[i].slow ?? 50 } : { ma: undefined, slow: undefined }) })
  }
  const draft = { symbol, tf: atf, op, conds }
  const valid = conds.every((c) => isFinite(c.value) && (!c.kind.startsWith('cross') || (c.slow ?? 0) > 0))
  const submit = () => {
    if (!valid) return
    if (app) askNotificationPermission()
    const when = new Date(expires).getTime()
    const data = { ...draft, repeat, expires: limited && isFinite(when) ? when : undefined, message: message.trim() || undefined, notify: { app, tg } }
    if (initial) update(initial.id, { ...data, active: true, armed: true })
    else add(data)
    onDone()
  }
  const numInput = (value: number | undefined, on: (v: number) => void, cls = '') => (
    <input className={`inp ${cls}`} inputMode="decimal" defaultValue={value} key={String(value)} onBlur={(e) => on(num(e.target.value))} />
  )
  if (picking) return <SymbolSearch onPick={(s) => (setSymbol(s), setPicking(false))} onClose={() => setPicking(false)} />
  return (
    <div className="space-y-3 text-xs">
      <button className="btn border border-line w-full justify-start" onClick={() => setPicking(true)}>
        <Search size={14} /> <b>{displayName(symbol)}</b> <span className="text-mute truncate">{getSymbol(symbol).name}</span>
        <span className="ml-auto tabular-nums">{fmt(price)}</span>
      </button>
      <section className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-mute flex-1">Koşul</span>
          <select className="inp w-auto h-7" value={atf} title="Zaman dilimi" aria-label="Zaman dilimi" onChange={(e) => setAtf(e.target.value as AlertTf)}>
            {ALERT_TFS.map((t) => <option key={t}>{t}</option>)}
          </select>
          {conds.length > 1 && (
            <select className="inp w-auto h-7" value={op} aria-label="Koşul bağlacı" onChange={(e) => setOp(e.target.value as 'AND' | 'OR')}>
              <option value="AND">Hepsi (VE)</option>
              <option value="OR">Herhangi biri (VEYA)</option>
            </select>
          )}
        </div>
        {conds.map((c, i) => {
          const s = shapeOf(c.kind)
          return (
            <div key={i} className="space-y-1 p-2 rounded border border-line">
              <div className="flex gap-1">
                <select className="inp" value={s.src} aria-label="Kaynak" onChange={(e) => reshape(i, { src: e.target.value as Src })}>
                  {(Object.keys(SRC_LABEL) as Src[]).map((k) => <option key={k} value={k}>{SRC_LABEL[k]}</option>)}
                </select>
                {conds.length > 1 && <button onClick={() => setConds(conds.filter((_, j) => j !== i))} aria-label="Koşulu sil"><X size={14} className="text-mute" /></button>}
              </div>
              <select className="inp" value={s.op} aria-label="İşlem" onChange={(e) => reshape(i, { op: e.target.value as Op })}>
                {opsFor(s.src, s.rhs).map((k) => <option key={k} value={k}>{OP_LABEL[k]}</option>)}
              </select>
              <div className="flex gap-1">
                {s.src === 'price' && (
                  <select className="inp" value={s.rhs} aria-label="Karşı taraf" onChange={(e) => reshape(i, { rhs: e.target.value as Rhs })}>
                    <option value="value">Değer</option>
                    <option value="ema">EMA (periyot)</option>
                  </select>
                )}
                {s.src === 'ma' && (
                  <select className="inp" value={c.ma} aria-label="Ortalama türü" onChange={(e) => edit(i, { ma: e.target.value as 'EMA' | 'SMA' })}>
                    <option>EMA</option>
                    <option>SMA</option>
                  </select>
                )}
                {numInput(c.value, (v) => edit(i, { value: v }))}
                {s.src === 'ma' && numInput(c.slow, (v) => edit(i, { slow: v }))}
              </div>
              {s.src === 'ma' && <p className="text-mute">İlk kutu hızlı, ikinci kutu yavaş periyot.</p>}
              {s.src === 'price' && s.rhs === 'value' && lines.length > 0 && (
                <select className="inp" value="" aria-label="Çizimden seviye seç" onChange={(e) => e.target.value && edit(i, { value: +e.target.value })}>
                  <option value="">Grafikteki yatay çizgiden seç…</option>
                  {lines.map((v, j) => <option key={j} value={v}>{fmt(v)}</option>)}
                </select>
              )}
            </div>
          )
        })}
        <button className="btn text-[#5b8cff] px-0" onClick={() => setConds([...conds, { kind: 'rsi_below', value: 30 }])}><Plus size={14} /> Koşul ekle</button>
      </section>
      <section className="space-y-2 pt-2 border-t border-line">
        <label className="flex items-center gap-2"><span className="text-mute flex-1">Tetiklenme</span>
          <select className="inp w-44" value={repeat ? '1' : '0'} onChange={(e) => setRepeat(e.target.value === '1')}>
            <option value="0">Yalnızca bir kez</option>
            <option value="1">Her seferinde</option>
          </select>
        </label>
        <label className="flex items-center gap-2"><span className="text-mute flex-1">Son kullanma tarihi</span>
          <input type="checkbox" checked={limited} aria-label="Son kullanma tarihi kullan" onChange={(e) => setLimited(e.target.checked)} />
          <input className="inp w-44" type="datetime-local" disabled={!limited} value={expires} onChange={(e) => setExpires(e.target.value)} />
        </label>
        <label className="block space-y-1"><span className="text-mute">Mesaj</span>
          <input className="inp" placeholder={`${displayName(symbol)} · ${alertText({ ...draft, id: '', active: true })}`} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <div className="flex items-center gap-3"><span className="text-mute flex-1">Bildirimler</span>
          <label className="flex items-center gap-1"><input type="checkbox" checked={app} onChange={(e) => setApp(e.target.checked)} /> Uygulama (ses + bildirim)</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={tg} onChange={(e) => setTg(e.target.checked)} /> Telegram</label>
        </div>
        {tg && !settings.tgToken && <p className="text-mute">Telegram için Ayarlar → Alarmlar bölümünde bot bilgilerini girin.</p>}
        {getSymbol(symbol).source === 'synthetic' && <p className="text-mute">Sentetik sembollerde alarm yalnızca uygulama açıkken çalışır.</p>}
      </section>
      <div className="flex gap-1 justify-end pt-2 border-t border-line">
        <button className="btn border border-line" onClick={onDone}>İptal</button>
        <button className="btn bg-acc text-white px-4" disabled={!valid} onClick={submit}>{initial ? 'Kaydet' : 'Oluştur'}</button>
      </div>
    </div>
  )
}
