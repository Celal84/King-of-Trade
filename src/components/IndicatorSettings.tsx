import { useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import Modal from './Modal'
import { useApp, type IndicatorConfig } from '../store/app'
import { paneApis } from '../lib/chartRegistry'
import { INDICATOR_LABELS, LINE_PALETTE, MULTI_PARAM, PARAM_HINTS, PARAM_SPECS, normalizeParams, paramLabel } from '../lib/indicators'
import { PIVOT_COLOR, PIVOT_LEVELS, type PivotLevel } from '../lib/pivot'
import { TIMEFRAMES, type Timeframe } from '../types'

type Tab = 'in' | 'style' | 'vis'
const TABS: [Tab, string][] = [['in', 'Girdiler'], ['style', 'Stil'], ['vis', 'Görünürlük']]

export default function IndicatorSettings({ name, onClose }: { name: string; onClose: () => void }) {
  const { active, indicatorConfig, setIndicatorConfig, toggleIndicator } = useApp()
  const cfg = indicatorConfig[name] ?? {}
  const original = useRef<IndicatorConfig>(cfg)
  // Varsayılan parametreler pencere açıldığında, ayar uygulanmadan önceki değerlerdir
  const info = useRef(paneApis.get(active)?.indicatorInfo(name) ?? { params: [], lines: 0, titles: [] }).current
  const [tab, setTab] = useState<Tab>('in')
  const [params, setParams] = useState<number[]>(() => normalizeParams(name, cfg.params ?? info.params))
  const lines = Math.min(info.lines, 8)
  const put = (p: Partial<IndicatorConfig>) => setIndicatorConfig(name, { ...cfg, ...p })
  const setParam = (list: number[]) => {
    setParams(list)
    if (!list.length || !list.every((n) => isFinite(n) && n >= 0)) return
    // Çoklu periyotta çizgi sayısı değişince kayıtlı stiller yeni sayıya uydurulur
    const fit = <T,>(a: T[] | undefined, def: (i: number) => T) => (a && MULTI_PARAM[name] ? list.map((_, i) => a[i] ?? def(i)) : a)
    put({ params: list, colors: fit(cfg.colors, (i) => LINE_PALETTE[i % LINE_PALETTE.length]), sizes: fit(cfg.sizes, () => 1), dashed: fit(cfg.dashed, () => false), hidden: fit(cfg.hidden, () => false) })
  }
  const full = <T,>(list: T[] | undefined, def: (i: number) => T) => Array.from({ length: lines }, (_, i) => list?.[i] ?? def(i))
  /** Stil dizileri her zaman tüm çizgiler için birlikte yazılır. */
  const style = (p: { colors?: string[]; sizes?: number[]; dashed?: boolean[]; hidden?: boolean[] }) => put({
    colors: full(cfg.colors, (i) => LINE_PALETTE[i % LINE_PALETTE.length]), sizes: full(cfg.sizes, () => 1),
    dashed: full(cfg.dashed, () => false), hidden: full(cfg.hidden, () => false), ...p,
  })
  const at = <T,>(list: T[], i: number, v: T) => list.map((x, j) => (j === i ? v : x))
  const colors = full(cfg.colors, (i) => LINE_PALETTE[i % LINE_PALETTE.length])
  const sizes = full(cfg.sizes, () => 1)
  const dashed = full(cfg.dashed, () => false)
  const hidden = full(cfg.hidden, () => false)
  const tfs = cfg.tfs ?? TIMEFRAMES
  const toggleTf = (t: Timeframe) => {
    const next = TIMEFRAMES.filter((x) => (x === t ? !tfs.includes(x) : tfs.includes(x)))
    put({ tfs: next.length === TIMEFRAMES.length ? undefined : next })
  }
  const reset = () => {
    setIndicatorConfig(name, {})
    setParams(normalizeParams(name, name === 'PIVOT' ? [] : info.params))
  }
  const specs = PARAM_SPECS[name] ?? []
  const pivot = Array.from({ length: PIVOT_LEVELS.length }, (_, i) => (cfg.extra as PivotLevel[] | undefined)?.[i] ?? { color: PIVOT_COLOR, on: true })
  const setPivot = (i: number, p: Partial<PivotLevel>) => put({ params, extra: at(pivot, i, { ...pivot[i], ...p }) })
  const levelCell = (i: number) => (
    <span key={i} className="flex items-center gap-1">
      <input type="color" className="w-7 h-7 bg-transparent" value={pivot[i].color} aria-label={`${PIVOT_LEVELS[i]} rengi`} onChange={(e) => setPivot(i, { color: e.target.value })} />
      <input type="checkbox" checked={pivot[i].on} aria-label={`${PIVOT_LEVELS[i]} göster`} onChange={(e) => setPivot(i, { on: e.target.checked })} />
    </span>
  )
  const cancel = () => {
    setIndicatorConfig(name, original.current)
    onClose()
  }
  return (
    <Modal title={INDICATOR_LABELS[name] ?? name} onClose={cancel}>
      <div className="text-xs">
        <div className="flex border-b border-line mb-3">
          {TABS.map(([k, l]) => <button key={k} className={`tab flex-1 ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'in' && (
          <div className="space-y-2">
            {params.length === 0 && <p className="text-mute">Bu indikatörün ayarlanabilir girdisi yok.</p>}
            {params.map((v, i) => (
              <label key={i} className="flex items-center gap-2 min-h-7">
                <span className="flex-1">{paramLabel(name, i)}</span>
                {specs[i]?.options ? (
                  <select className="inp w-32" value={v} onChange={(e) => setParam(at(params, i, +e.target.value))}>
                    {specs[i].options!.map((o, j) => <option key={o} value={j}>{o}</option>)}
                  </select>
                ) : specs[i]?.bool ? <input type="checkbox" checked={!!v} onChange={(e) => setParam(at(params, i, +e.target.checked))} />
                  : <input className="inp w-28" type="number" step="any" min="0" value={Number.isFinite(v) ? v : ''} onChange={(e) => setParam(at(params, i, parseFloat(e.target.value)))} />}
              </label>
            ))}
            {name === 'PIVOT' && (
              <div className="space-y-1 pt-2 border-t border-line">
                <p className="text-mute uppercase text-[10px]">Seviyeler</p>
                <div className="flex items-center gap-2"><span className="flex-1">P</span>{levelCell(0)}<span className="w-[52px]" /></div>
                {[1, 3, 5, 7, 9].map((i) => (
                  <div key={i} className="flex items-center gap-2"><span className="flex-1">{PIVOT_LEVELS[i]} / {PIVOT_LEVELS[i + 1]}</span>{levelCell(i)}{levelCell(i + 1)}</div>
                ))}
                <p className="text-mute">Gün içi grafiklerde dönem değerleri günlük mumlardan hesaplanır. Seçilen tipte olmayan seviyeler çizilmez.</p>
              </div>
            )}
            {MULTI_PARAM[name] && (
              <div className="flex gap-1">
                <button className="btn border border-line" onClick={() => setParam([...params, (params.at(-1) ?? 10) * 2])}><Plus size={13} /> Ekle</button>
                {params.length > 1 && <button className="btn border border-line" onClick={() => setParam(params.slice(0, -1))}><Minus size={13} /> Sonuncuyu kaldır</button>}
              </div>
            )}
            {PARAM_HINTS[name] && <p className="text-mute">{PARAM_HINTS[name]}</p>}
          </div>
        )}
        {tab === 'style' && (
          <div className="space-y-2">
            {lines === 0 && <p className="text-mute">Bu indikatörde ayarlanabilir çizgi yok.</p>}
            {Array.from({ length: lines }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="checkbox" checked={!hidden[i]} aria-label={`${info.titles[i]} görünür`} onChange={(e) => style({ hidden: at(hidden, i, !e.target.checked) })} />
                <span className="flex-1 truncate">{info.titles[i] ?? `Çizgi ${i + 1}`}</span>
                <input type="color" className="w-7 h-7 bg-transparent" value={colors[i]} aria-label="Renk" onChange={(e) => style({ colors: at(colors, i, e.target.value) })} />
                <select className="inp w-16" value={sizes[i]} aria-label="Kalınlık" onChange={(e) => style({ sizes: at(sizes, i, +e.target.value) })}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}px</option>)}
                </select>
                <select className="inp w-24" value={dashed[i] ? '1' : '0'} aria-label="Çizgi stili" onChange={(e) => style({ dashed: at(dashed, i, e.target.value === '1') })}>
                  <option value="0">Düz</option>
                  <option value="1">Kesikli</option>
                </select>
              </div>
            ))}
          </div>
        )}
        {tab === 'vis' && (
          <div className="space-y-2">
            <p className="text-mute">İndikatör yalnızca işaretli zaman dilimlerinde gösterilir.</p>
            <div className="grid grid-cols-5 gap-1">
              {TIMEFRAMES.map((t) => (
                <label key={t} className="flex items-center gap-1"><input type="checkbox" checked={tfs.includes(t)} onChange={() => toggleTf(t)} /> {t}</label>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-line">
          <select className="inp w-auto" value="" aria-label="Varsayılanlar" onChange={(e) => (e.target.value === 'reset' ? reset() : e.target.value === 'remove' && (toggleIndicator(name), onClose()))}>
            <option value="">Varsayılan ▾</option>
            <option value="reset">Ayarları sıfırla</option>
            <option value="remove">İndikatörü kaldır</option>
          </select>
          <button className="btn border border-line ml-auto" onClick={cancel}>İptal</button>
          <button className="btn bg-acc text-white px-4" onClick={onClose}>Tamam</button>
        </div>
      </div>
    </Modal>
  )
}
