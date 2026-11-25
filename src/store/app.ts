import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CandleKind, Ccy, Layout, Quote, Timeframe } from '../types'

export type PanelTab = 'watch' | 'scan' | 'fund' | 'paper'

interface Settings {
  proxyUrl: string
  tgToken: string
  tgChat: string
}

interface AppState {
  panes: string[]
  active: number
  layout: Layout
  tf: Timeframe
  candleKind: CandleKind
  logScale: boolean
  ccy: Ccy
  indicators: string[]
  magnet: boolean
  drawingsVisible: boolean
  favorites: string[]
  settings: Settings
  tab: PanelTab
  prices: Record<string, Quote>
  watchSymbols: string[]
  snapshotAt: number | null
  setSymbol: (s: string) => void
  setActive: (i: number) => void
  set: (p: Partial<Pick<AppState, 'layout' | 'tf' | 'ccy' | 'candleKind' | 'logScale' | 'magnet' | 'drawingsVisible' | 'tab' | 'watchSymbols' | 'snapshotAt'>>) => void
  toggleIndicator: (n: string) => void
  toggleFavorite: (s: string) => void
  setSettings: (s: Partial<Settings>) => void
  setPrices: (p: Record<string, Quote>) => void
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      panes: ['THYAO.IS', 'BTCUSDT', 'GAUTRY', 'XU100.IS'],
      active: 0,
      layout: '1x1',
      tf: '1d',
      candleKind: 'candle',
      logScale: false,
      ccy: 'ORG',
      indicators: ['VOL'],
      magnet: false,
      drawingsVisible: true,
      favorites: ['THYAO.IS', 'GAUTRY', 'BTCUSDT', 'USDTRY=X'],
      settings: { proxyUrl: '', tgToken: '', tgChat: '' },
      tab: 'watch',
      prices: {},
      watchSymbols: [],
      snapshotAt: null,
      setSymbol: (s) => set((st) => ({ panes: st.panes.map((p, i) => (i === st.active ? s : p)) })),
      setActive: (active) => set({ active }),
      set: (p) => set(p),
      toggleIndicator: (n) => set((st) => ({ indicators: st.indicators.includes(n) ? st.indicators.filter((x) => x !== n) : [...st.indicators, n] })),
      toggleFavorite: (s) => set((st) => ({ favorites: st.favorites.includes(s) ? st.favorites.filter((x) => x !== s) : [...st.favorites, s] })),
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      setPrices: (p) => set((st) => ({ prices: { ...st.prices, ...p } })),
    }),
    {
      name: 'kot:app',
      partialize: ({ prices: _p, watchSymbols: _w, snapshotAt: _s, ...rest }) => rest,
    },
  ),
)
