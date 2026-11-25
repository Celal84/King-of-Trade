import { getSupportedIndicators } from 'klinecharts'
import { Check } from 'lucide-react'
import Modal from './Modal'
import { useApp } from '../store/app'
import { MAIN_PANE_INDICATORS } from '../lib/klineSetup'

const POPULAR = ['MA', 'EMA', 'BOLL', 'SAR', 'VOL', 'MACD', 'RSI', 'KDJ', 'ATR', 'CCI', 'OBV']

export default function IndicatorMenu({ onClose }: { onClose: () => void }) {
  const { indicators, toggleIndicator } = useApp()
  const rest = getSupportedIndicators().filter((n) => !POPULAR.includes(n)).sort()
  const row = (n: string) => (
    <button key={n} className={`btn justify-between w-full ${indicators.includes(n) ? 'btn-on' : ''}`} onClick={() => toggleIndicator(n)}>
      <span>{n} <span className="text-mute">{MAIN_PANE_INDICATORS.includes(n) ? '· ana grafik' : ''}</span></span>
      {indicators.includes(n) && <Check size={14} />}
    </button>
  )
  return (
    <Modal title="İndikatörler" onClose={onClose}>
      <p className="text-xs text-mute mb-1">Popüler</p>
      <div className="grid grid-cols-2 gap-1">{POPULAR.map(row)}</div>
      <p className="text-xs text-mute mt-3 mb-1">Diğer</p>
      <div className="grid grid-cols-2 gap-1">{rest.map(row)}</div>
    </Modal>
  )
}
