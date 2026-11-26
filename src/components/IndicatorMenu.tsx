import { useState } from 'react'
import { getSupportedIndicators } from 'klinecharts'
import { Check, Settings2, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../store/app'
import { COMPARE_SLOTS, MAIN_PANE_INDICATORS } from '../lib/klineSetup'
import { paneApis } from '../lib/chartRegistry'
import { INDICATOR_LABELS } from '../lib/indicators'

const POPULAR = ['MA', 'EMA', 'BOLL', 'VWAP', 'SUPERTREND', 'ICHIMOKU', 'PIVOT', 'VPVR', 'VOL', 'MACD', 'RSI', 'STOCHRSI', 'CMF', 'MFI', 'ATR', 'SAR', 'DONCHIAN', 'KELTNER', 'HMA', 'KDJ', 'CCI', 'OBV']
const PALETTE = ['#ff9600', '#935ebd', '#2196f3', '#e11d74', '#01c5c4']

function Editor({ name }: { name: string }) {
  const { active, indicatorConfig, setIndicatorConfig } = useApp()
  const info = paneApis.get(active)?.indicatorInfo(name)
  const cfg = indicatorConfig[name] ?? {}
  const [params, setParams] = useState((cfg.params ?? info?.params ?? []).join(', '))
  const colors = Array.from({ length: Math.min(info?.lines ?? 0, 5) }, (_, i) => cfg.colors?.[i] ?? PALETTE[i])
  const apply = (next: { params?: string; colors?: string[] }) => {
    const p = (next.params ?? params).split(/[\s,;]+/).map(Number).filter((n) => isFinite(n) && n > 0)
    setIndicatorConfig(name, { params: p.length ? p : undefined, colors: next.colors ?? cfg.colors })
  }
  return (
    <div className="p-2 mb-1 rounded border border-line space-y-2">
      <label className="block">
        <span className="text-mute">Periyotlar (virgülle; MA ve EMA’da istediğiniz kadar)</span>
        <input className="inp mt-1" inputMode="decimal" value={params} onChange={(e) => setParams(e.target.value)} onBlur={() => apply({})} onKeyDown={(e) => e.key === 'Enter' && apply({})} />
      </label>
      {colors.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-mute">Renkler</span>
          {colors.map((c, i) => (
            <input key={i} type="color" className="w-7 h-7 bg-transparent" value={c} onChange={(e) => apply({ colors: colors.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
        </div>
      )}
      <button className="btn border border-line" onClick={() => (setIndicatorConfig(name, {}), setParams((info?.params ?? []).join(', ')))}>Varsayılana dön</button>
    </div>
  )
}

export default function IndicatorMenu({ onClose }: { onClose: () => void }) {
  const { indicators, toggleIndicator, templates, saveTemplate, applyTemplate, removeTemplate } = useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const rest = getSupportedIndicators().filter((n) => !POPULAR.includes(n) && !COMPARE_SLOTS.includes(n)).sort()
  const row = (n: string) => (
    <button key={n} className={`btn justify-between w-full ${indicators.includes(n) ? 'btn-on' : ''}`} onClick={() => toggleIndicator(n)}>
      <span className="truncate text-left">{INDICATOR_LABELS[n] ?? n} <span className="text-mute">{MAIN_PANE_INDICATORS.includes(n) ? '· ana grafik' : ''}</span></span>
      {indicators.includes(n) && <Check size={14} />}
    </button>
  )
  return (
    <Modal title="İndikatörler" onClose={onClose}>
      <div className="text-xs">
        <div className="flex gap-1 mb-3">
          <select className="inp h-8 text-xs" value="" onChange={(e) => e.target.value && applyTemplate(+e.target.value)}>
            <option value="">Şablon uygula… ({templates.length})</option>
            {templates.map((t, i) => <option key={t.name} value={i}>{t.name} · {t.tf} · {t.indicators.join(', ')}</option>)}
          </select>
          <button className="btn border border-line" onClick={() => { const n = window.prompt('Şablon adı (zaman dilimi, mum tipi ve indikatörler kaydedilir):')?.trim(); if (n) saveTemplate(n) }}>Kaydet</button>
          {templates.length > 0 && <button className="btn border border-line text-down" onClick={() => { const n = window.prompt(`Silinecek şablon adı:\n${templates.map((t) => t.name).join(', ')}`)?.trim(); const i = templates.findIndex((t) => t.name === n); if (i >= 0) removeTemplate(i) }}>Sil</button>}
        </div>
        {indicators.length > 0 && <p className="text-mute mb-1">Etkin — ayar için dişliye dokunun</p>}
        {indicators.map((n) => (
          <div key={n}>
            <div className="flex items-center gap-1 mb-1">
              <span className="flex-1 font-semibold">{INDICATOR_LABELS[n] ?? n}</span>
              <button className={`btn ${editing === n ? 'btn-on' : ''}`} onClick={() => setEditing(editing === n ? null : n)}><Settings2 size={14} /> Ayarlar</button>
              <button className="btn text-down" aria-label="Kaldır" onClick={() => toggleIndicator(n)}><X size={14} /></button>
            </div>
            {editing === n && <Editor name={n} />}
          </div>
        ))}
        <p className="text-mute mt-3 mb-1">Popüler</p>
        <div className="grid grid-cols-2 gap-1">{POPULAR.map(row)}</div>
        <p className="text-mute mt-3 mb-1">Diğer</p>
        <div className="grid grid-cols-2 gap-1">{rest.map(row)}</div>
      </div>
    </Modal>
  )
}
