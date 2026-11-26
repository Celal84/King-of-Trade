import { useEffect, useState } from 'react'
import { Play, Save, Trash2 } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../store/app'
import { SAMPLE, usePine, type PineValues } from '../store/pine'
import { paneApis } from '../lib/chartRegistry'
import { pineError, pineInputs, runPine, type PineInput } from '../lib/pine'

const NUMERIC = ['int', 'float', 'price']

export function PineInputs({ meta, values, onChange }: { meta: PineInput[]; values: PineValues; onChange: (v: PineValues) => void }) {
  if (!meta.length) return <p className="text-mute">Bu scriptte input() yok.</p>
  const set = (name: string, v: unknown) => onChange({ ...values, [name]: v })
  return (
    <div className="space-y-1">
      {meta.map((m) => {
        const v = values[m.name] ?? m.defval
        return (
          <label key={m.name} className="flex items-center gap-2">
            <span className="flex-1 text-mute">{m.name}</span>
            {m.type === 'bool' ? <input type="checkbox" checked={!!v} onChange={(e) => set(m.name, e.target.checked)} />
              : m.options?.length ? (
                <select className="inp h-7 text-xs w-32" value={String(v)} onChange={(e) => set(m.name, NUMERIC.includes(m.type) ? +e.target.value : e.target.value)}>
                  {m.options.map((o) => <option key={String(o)}>{String(o)}</option>)}
                </select>
              ) : NUMERIC.includes(m.type) ? (
                <input className="inp h-7 text-xs w-32" type="number" step={m.step ?? 'any'} min={m.minval} max={m.maxval} defaultValue={Number(v)}
                  onBlur={(e) => isFinite(parseFloat(e.target.value)) && set(m.name, parseFloat(e.target.value))} />
              ) : <input className="inp h-7 text-xs w-32" defaultValue={String(v ?? '')} onBlur={(e) => set(m.name, e.target.value)} />}
          </label>
        )
      })}
    </div>
  )
}

/** Grafikteki ⚙ düğmesiyle açılan input() ayarları. */
export function PineSettings({ name, onClose }: { name: string; onClose: () => void }) {
  const script = usePine((s) => (s.draft?.name === name ? s.draft : s.scripts.find((x) => x.name === name)))
  const setInputs = usePine((s) => s.setInputs)
  const [meta, setMeta] = useState<PineInput[] | null>(null)
  useEffect(() => {
    if (script) pineInputs(script.code).then(setMeta, () => setMeta([]))
  }, [script?.code])
  return (
    <Modal title={`${name} — Ayarlar`} onClose={onClose}>
      <div className="text-xs">
        {!script ? <p className="text-mute">Script bulunamadı.</p> : !meta ? <p className="text-mute">Yükleniyor…</p>
          : <PineInputs meta={meta} values={script.inputs} onChange={(v) => setInputs(name, v)} />}
      </div>
    </Modal>
  )
}

export default function PineEditor({ initial }: { initial?: string }) {
  const { scripts, draft, setDraft, save, remove } = usePine()
  const { active, tf } = useApp()
  const start = draft ?? scripts.find((s) => s.name === initial) ?? scripts[0] ?? SAMPLE
  const [name, setName] = useState(start.name)
  const [code, setCode] = useState(start.code)
  const [inputs, setInputs] = useState<PineValues>(start.inputs)
  const [meta, setMeta] = useState<PineInput[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const saved = scripts.some((s) => s.name === name)
  const pick = (n: string) => {
    const s = scripts.find((x) => x.name === n) ?? { name: 'Yeni Script', code: '//@version=6\nindicator("Yeni Script", overlay=true)\nplot(ta.ema(close, 20), "EMA 20")\n', inputs: {} }
    setName(s.name)
    setCode(s.code)
    setInputs(s.inputs)
    setMeta([])
    setMsg(null)
  }
  /** Scripti grafiğin mum verisiyle dener; başarılıysa sonucu döndürür. */
  const check = async (values = inputs) => {
    const candles = paneApis.get(active)?.candles() ?? []
    if (candles.length < 2) return setMsg({ ok: false, text: 'Grafik verisi henüz yüklenmedi.' })
    setBusy(true)
    try {
      const r = await runPine(code, candles, values, tf)
      setMeta(r.inputs)
      const skipped = r.skipped.length ? ` Çizilemeyen çıktılar: ${r.skipped.join(', ')}.` : ''
      setMsg({ ok: r.plots.length > 0, text: r.plots.length ? `✓ ${r.plots.length} çizim, ${r.overlay ? 'ana grafikte' : 'alt panelde'}.${skipped}` : `Çizilecek plot() çıktısı yok.${skipped}` })
      return r.plots.length > 0
    } catch (e) {
      setMsg({ ok: false, text: pineError(e, code) })
    } finally {
      setBusy(false)
    }
  }
  const run = async (values = inputs) => {
    if (await check(values)) setDraft({ name: name.trim() || 'Script', code, inputs: values, on: true })
  }
  const store = async () => {
    if (!name.trim()) return setMsg({ ok: false, text: 'Script adı gerekli.' })
    if (await check()) save({ name: name.trim(), code, inputs, on: true })
  }
  const onInputs = (v: PineValues) => {
    setInputs(v)
    run(v)
  }
  return (
    <div className="space-y-2 text-xs">
      <div className="flex gap-1">
        <select className="inp h-8 text-xs" value={saved ? name : ''} onChange={(e) => pick(e.target.value)}>
          <option value="">+ Yeni script</option>
          {scripts.map((s) => <option key={s.name}>{s.name}</option>)}
        </select>
        <input className="inp h-8 text-xs" placeholder="Script adı" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <textarea className="inp font-mono text-[11px] leading-4 h-56 whitespace-pre" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Pine Script kodu" />
      <div className="flex gap-1">
        <button className="btn bg-acc text-white px-3" disabled={busy} onClick={() => run()}><Play size={13} /> Çalıştır</button>
        <button className="btn border border-line" disabled={busy} onClick={store}><Save size={13} /> Kaydet</button>
        {draft && <button className="btn border border-line" onClick={() => setDraft(null)}>Denemeyi kaldır</button>}
        {saved && <button className="btn text-down ml-auto" aria-label="Scripti sil" onClick={() => confirm(`"${name}" silinsin mi?`) && (remove(name), pick(''))}><Trash2 size={13} /></button>}
      </div>
      {msg && <p className={msg.ok ? 'text-up' : 'text-down'}>{msg.text}</p>}
      {meta.length > 0 && <PineInputs key={name} meta={meta} values={inputs} onChange={onInputs} />}
      <p className="text-mute">Kod tarayıcıda, etkin grafiğin mumlarıyla çalışır (PineTS, AGPL-3.0). plot() ve hline() çizilir; plotshape, bgcolor, strategy gibi çıktılar çizilmez.</p>
    </div>
  )
}
