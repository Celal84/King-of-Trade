import type { Timeframe } from '../types'

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
}

export const paneApis = new Map<number, PaneApi>()
