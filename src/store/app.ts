import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CandleKind, Ccy, Layout, Quote, Timeframe } from '../types'

export type PanelTab = 'watch' | 'scan' | 'fund' | 'paper'
export interface WatchList { name: string; symbols: string[] }
export interface IndicatorConfig { params?: number[]; colors?: string[] }
export interface Template { name: string; tf: Timeframe; candleKind: CandleKind; logScale: boolean; indicators: string[]; indicatorConfig: Record<string, IndicatorConfig> }

export type ScanOp = '<' | '>' | '<=' | '>='
export interface ScanRule { field: string; op: ScanOp; value: number }
export interface ScanFilter { name: string; rules: ScanRule[] }

interface Settings {
  proxyUrl: string
  tgToken: string
  tgChat: string
  syncCode?: string
}

const PANES = ['THYAO.IS', 'BTCUSDT', 'GAUTRY', 'XU100.IS', 'USDTRY=X', 'ETHUSDT']
const DEFAULT_LIST: WatchList = { name: 'Favoriler', symbols: ['THYAO.IS', 'XU100.IS', 'GAUTRY', 'USDTRY=X', 'BTCUSDT'] }

type Patch = 'layout' | 'tf' | 'ccy' | 'candleKind' | 'logScale' | 'magnet' | 'drawingsVisible' | 'tab' | 'watchSymbols' | 'snapshotAt' | 'cryptoCount' | 'listIdx' | 'drawColor' | 'drawSize' | 'editIndicator' | 'proxyDown'

interface AppState {
  panes: string[]
  active: number
  layout: Layout
  tf: Timeframe
  candleKind: CandleKind
  logScale: boolean
  ccy: Ccy
  indicators: string[]
  indicatorConfig: Record<string, IndicatorConfig>
  compare: string[]
  magnet: boolean
  drawingsVisible: boolean
  drawColor: string
  drawSize: number
  templates: Template[]
  scans: ScanFilter[]
  lists: WatchList[]
  listIdx: number
  settings: Settings
  tab: PanelTab
  prices: Record<string, Quote>
  watchSymbols: string[]
  snapshotAt: number | null
  cryptoCount: number
  editIndicator: string | null
  proxyDown: boolean
  notes: Record<string, string>
  setNote: (symbol: string, text: string) => void
  setSymbol: (s: string) => void
  setActive: (i: number) => void
  set: (p: Partial<Pick<AppState, Patch>>) => void
  toggleIndicator: (n: string) => void
  setIndicatorConfig: (n: string, c: IndicatorConfig) => void
  toggleCompare: (s: string) => void
  saveTemplate: (name: string) => void
  applyTemplate: (i: number) => void
  removeTemplate: (i: number) => void
  saveScan: (f: ScanFilter) => void
  removeScan: (name: string) => void
  toggleFavorite: (s: string) => void
  addList: (name: string) => void
  renameList: (name: string) => void
  removeList: () => void
  setSettings: (s: Partial<Settings>) => void
  setPrices: (p: Record<string, Quote>) => void
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
const editList = (st: AppState, fn: (l: WatchList) => WatchList) => ({ lists: st.lists.map((l, i) => (i === st.listIdx ? fn(l) : l)) })

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      panes: PANES,
      active: 0,
      layout: '1x1',
      tf: '1d',
      candleKind: 'candle',
      logScale: false,
      ccy: 'ORG',
      indicators: ['VOL'],
      indicatorConfig: {},
      compare: [],
      magnet: false,
      drawingsVisible: true,
      drawColor: '#2962ff',
      drawSize: 1,
      templates: [],
      scans: [],
      lists: [DEFAULT_LIST],
      listIdx: 0,
      settings: { proxyUrl: '', tgToken: '', tgChat: '' },
      tab: 'watch',
      prices: {},
      watchSymbols: [],
      snapshotAt: null,
      cryptoCount: 0,
      editIndicator: null,
      proxyDown: false,
      notes: {},
      setNote: (symbol, text) => set((st) => {
        const { [symbol]: _old, ...rest } = st.notes
        return { notes: text ? { ...rest, [symbol]: text } : rest }
      }),
      setSymbol: (s) => set((st) => ({ panes: st.panes.map((p, i) => (i === st.active ? s : p)) })),
      setActive: (active) => set({ active }),
      set: (p) => set(p),
      toggleIndicator: (n) => set((st) => ({ indicators: toggle(st.indicators, n) })),
      setIndicatorConfig: (n, c) => set((st) => ({ indicatorConfig: { ...st.indicatorConfig, [n]: c } })),
      toggleCompare: (s) => set((st) => ({ compare: toggle(st.compare, s).slice(-4) })),
      saveTemplate: (name) => set((st) => ({
        templates: [...st.templates.filter((t) => t.name !== name), { name, tf: st.tf, candleKind: st.candleKind, logScale: st.logScale, indicators: st.indicators, indicatorConfig: st.indicatorConfig }],
      })),
      applyTemplate: (i) => set((st) => {
        const t = st.templates[i]
        return t ? { tf: t.tf, candleKind: t.candleKind, logScale: t.logScale, indicators: t.indicators, indicatorConfig: { ...st.indicatorConfig, ...t.indicatorConfig } } : {}
      }),
      removeTemplate: (i) => set((st) => ({ templates: st.templates.filter((_, j) => j !== i) })),
      saveScan: (f) => set((st) => ({ scans: [...st.scans.filter((x) => x.name !== f.name), f] })),
      removeScan: (name) => set((st) => ({ scans: st.scans.filter((x) => x.name !== name) })),
      toggleFavorite: (s) => set((st) => editList(st, (l) => ({ ...l, symbols: toggle(l.symbols, s) }))),
      addList: (name) => set((st) => ({ lists: [...st.lists, { name, symbols: [] }], listIdx: st.lists.length })),
      renameList: (name) => set((st) => editList(st, (l) => ({ ...l, name }))),
      removeList: () => set((st) => (st.lists.length > 1 ? { lists: st.lists.filter((_, i) => i !== st.listIdx), listIdx: 0 } : {})),
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      setPrices: (p) => set((st) => ({ prices: { ...st.prices, ...p } })),
    }),
    {
      name: 'kot:app',
      version: 1,
      migrate: (old) => {
        const o = old as Partial<AppState> & { favorites?: string[] }
        return { ...o, listIdx: 0, lists: o.lists ?? [{ name: 'Favoriler', symbols: o.favorites ?? DEFAULT_LIST.symbols }], panes: [...(o.panes ?? []), ...PANES].slice(0, PANES.length) } as AppState
      },
      partialize: ({ prices: _p, watchSymbols: _w, snapshotAt: _s, cryptoCount: _c, editIndicator: _e, proxyDown: _d, ...rest }) => rest,
    },
  ),
)

export const useFavorites = () => useApp((s) => s.lists[s.listIdx]?.symbols ?? s.lists[0].symbols)
