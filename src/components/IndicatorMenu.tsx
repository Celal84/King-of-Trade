import { useState } from 'react'
import { getSupportedIndicators } from 'klinecharts'
import { Check, Settings2, X } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../store/app'
import { COMPARE_SLOTS, MAIN_PANE_INDICATORS } from '../lib/klineSetup'
import { INDICATOR_LABELS } from '../lib/indicators'
import { usePine } from '../store/pine'
import PineEditor from './PineEditor'

const POPULAR = ['MA', 'EMA', 'BOLL', 'VWAP', 'SUPERTREND', 'ICHIMOKU', 'PIVOT', 'VPVR', 'VOL', 'MACD', 'RSI', 'STOCHRSI', 'CMF', 'MFI', 'ATR', 'SAR', 'DONCHIAN', 'KELTNER', 'HMA', 'KDJ', 'CCI', 'OBV']
export default function IndicatorMenu({ onClose }: { onClose: () => void }) {
  const { indicators, toggleIndicator, templates, saveTemplate, applyTemplate, removeTemplate, set } = useApp()
  const [tab, setTab] = useState<'list' | 'pine'>('list')
  const [pineName, setPineName] = useState<string>()
  const pine = usePine()
  const rest = getSupportedIndicators().filter((n) => !POPULAR.includes(n) && !COMPARE_SLOTS.includes(n)).sort()
  const row = (n: string) => (
    <button key={n} className={`btn justify-between w-full ${indicators.includes(n) ? 'btn-on' : ''}`} onClick={() => toggleIndicator(n)}>
      <span className="truncate text-left">{INDICATOR_LABELS[n] ?? n} <span className="text-mute">{MAIN_PANE_INDICATORS.includes(n) ? '· ana grafik' : ''}</span></span>
      {indicators.includes(n) && <Check size={14} />}
    </button>
  )
  return (
    <Modal title="İndikatörler" onClose={onClose}>
      <div className="flex border-b border-line mb-2 text-xs">
        <button className={`tab flex-1 ${tab === 'list' ? 'tab-on' : ''}`} onClick={() => setTab('list')}>İndikatörler</button>
        <button className={`tab flex-1 ${tab === 'pine' ? 'tab-on' : ''}`} onClick={() => setTab('pine')}>Pine Script</button>
      </div>
      {tab === 'pine' ? <PineEditor key={pineName} initial={pineName} /> : (
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
              <button className="btn" onClick={() => set({ editIndicator: n })}><Settings2 size={14} /> Ayarlar</button>
              <button className="btn text-down" aria-label="Kaldır" onClick={() => toggleIndicator(n)}><X size={14} /></button>
            </div>
          </div>
        ))}
        <p className="text-mute mt-3 mb-1">Benim İndikatörlerim (Pine Script)</p>
        {pine.scripts.map((sc) => (
          <div key={sc.name} className="flex items-center gap-1 mb-1">
            <button className={`btn justify-between flex-1 ${sc.on ? 'btn-on' : ''}`} onClick={() => pine.toggle(sc.name)}>
              <span className="truncate text-left">{sc.name}</span>
              {sc.on && <Check size={14} />}
            </button>
            <button className="btn" onClick={() => (setPineName(sc.name), setTab('pine'))}><Settings2 size={14} /> Düzenle</button>
          </div>
        ))}
        <p className="text-mute mt-3 mb-1">Popüler</p>
        <div className="grid grid-cols-2 gap-1">{POPULAR.map(row)}</div>
        <p className="text-mute mt-3 mb-1">Diğer</p>
        <div className="grid grid-cols-2 gap-1">{rest.map(row)}</div>
      </div>
      )}
    </Modal>
  )
}
