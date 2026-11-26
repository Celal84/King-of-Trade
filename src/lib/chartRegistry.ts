import type { Candle, Timeframe } from '../types'

export interface Marker { timestamp: number; price: number; buy: boolean }

export interface PaneApi {
  draw: (name: string) => void
  clear: () => void
  zoom: (factor: number) => void
  scalePrice: (factor: number) => void
  autoPrice: () => void
  toLatest: () => void
  reset: () => void
  /** Zaman dilimini ayarlar ve son `ms` süreyi ekrana sığdırır. */
  fit: (ms: number, tf: Timeframe) => void
  undo: () => void
  screenshot: () => void
  /** Etkin indikatörün geçerli parametreleri ve çizgi sayısı. */
  /** Grafikte yüklü ham mum verisi. */
  candles: () => Candle[]
  /** Strateji testi al/sat işaretlerini çizer; boş liste işaretleri temizler. */
  markers: (list: Marker[]) => void
  indicatorInfo: (name: string) => { params: number[]; lines: number } | null
}

export const paneApis = new Map<number, PaneApi>()
