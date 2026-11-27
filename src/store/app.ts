import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CandleKind, Ccy, Layout, Quote, Timeframe } from '../types'

export type PanelTab = 'watch' | 'scan' | 'fund' | 'paper' | 'test'
/** symbols: sembol kodları ve `#Bölüm adı` biçiminde bölüm başlıkları, görüntülenme sırasıyla. */
export interface WatchList { name: string; symbols: string[] }
export const SECTION = '#'
export const isSection = (entry: string) => entry.startsWith(SECTION)
/** Stil dizileri (colors, sizes, dashed, hidden) çizgi sayısı kadar eleman taşır. tfs: yalnızca bu zaman dilimlerinde göster. */
export interface IndicatorConfig { params?: number[]; colors?: string[]; sizes?: number[]; dashed?: boolean[]; hidden?: boolean[]; tfs?: Timeframe[]; extra?: unknown }
export interface Template { name: string; tf: Timeframe; candleKind: CandleKind; logScale: boolean; indicators: string[]; indicatorConfig: Record<string, IndicatorConfig> }

export type ScanOp = '<' | '>' | '<=' | '>='
export interface ScanRule { field: string; op: ScanOp; value: number }
export interface ScanFilter { name: string; rules: ScanRule[] }

export interface ChartLook {
  up: string; down: string; priceLine: boolean; highLow: boolean
  showName: boolean; showStatus: boolean; showChange: boolean; ohlc: boolean; indValues: boolean
  gridH: boolean; gridV: boolean; crosshair: boolean; fontSize: number
  bg: string; gridColor: string; axisText: string
}
export const DEFAULT_LOOK: ChartLook = {
  up: '#26a69a', down: '#ef5350', priceLine: true, highLow: true,
  showName: true, showStatus: true, showChange: true, ohlc: true, indValues: true,
  gridH: true, gridV: true, crosshair: true, fontSize: 12,
  bg: '#131722', gridColor: '#1f2430', axisText: '#787b86',
}

export interface TxDraft { symbol?: string; side?: 'buy' | 'sell'; id?: string }

interface Settings {
  proxyUrl: string
  tgToken: string
  tgChat: string
  syncCode?: string
  syncOn?: boolean
  syncAt?: number
  /** Alarm tetiklenince sesli uyarı / tarayıcı bildirimi (varsayılan: açık). */
  sound?: boolean
  notify?: boolean
}

const PANES = ['THYAO.IS', 'BTCUSDT', 'GAUTRY', 'XU100.IS', 'USDTRY=X', 'ETHUSDT']
const DEFAULT_LIST: WatchList = { name: 'Favoriler', symbols: ['THYAO.IS', 'XU100.IS', 'GAUTRY', 'USDTRY=X', 'BTCUSDT'] }

type Patch = 'layout' | 'tf' | 'ccy' | 'candleKind' | 'logScale' | 'magnet' | 'drawingsVisible' | 'tab' | 'watchSymbols' | 'snapshotAt' | 'cryptoCount' | 'listIdx' | 'drawColor' | 'drawSize' | 'editIndicator' | 'proxyDown' | 'percentScale' | 'look' | 'txForm' | 'alertSymbol'

interface AppState {
  panes: string[]
  active: number
  layout: Layout
  tf: Timeframe
  candleKind: CandleKind
  logScale: boolean
  percentScale: boolean
  look: ChartLook
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
  /** Açık portföy işlem formu (null: kapalı). */
  txForm: TxDraft | null
  /** Alarm penceresinin açılacağı sembol (null: kapalı). */
  alertSymbol: string | null
  flags: Record<string, string>
  setFlag: (symbol: string, color: string | null) => void
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
  addSection: (name: string, at?: number) => void
  renameSection: (from: string, to: string) => void
  removeEntry: (index: number) => void
  moveEntry: (from: number, to: number) => void
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
      percentScale: false,
      look: DEFAULT_LOOK,
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
      txForm: null,
      alertSymbol: null,
      flags: {},
      setFlag: (symbol, color) => set((st) => {
        const { [symbol]: _old, ...rest } = st.flags
        return { flags: color ? { ...rest, [symbol]: color } : rest }
      }),
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
      addSection: (name, at) => set((st) => editList(st, (l) => {
        if (l.symbols.includes(SECTION + name)) return l
        const next = [...l.symbols]
        next.splice(at ?? next.length, 0, SECTION + name)
        return { ...l, symbols: next }
      })),
      renameSection: (from, to) => set((st) => editList(st, (l) => ({ ...l, symbols: l.symbols.map((x) => (x === SECTION + from ? SECTION + to : x)) }))),
      removeEntry: (index) => set((st) => editList(st, (l) => ({ ...l, symbols: l.symbols.filter((_, i) => i !== index) }))),
      moveEntry: (from, to) => set((st) => editList(st, (l) => {
        const next = [...l.symbols]
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        return { ...l, symbols: next }
      })),
      addList: (name) => set((st) => ({ lists: [...st.lists, { name, symbols: [] }], listIdx: st.lists.length })),
      renameList: (name) => set((st) => editList(st, (l) => ({ ...l, name }))),
      removeList: () => set((st) => (st.lists.length > 1 ? { lists: st.lists.filter((_, i) => i !== st.listIdx), listIdx: 0 } : {})),
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      setPrices: (p) => set((st) => ({ prices: { ...st.prices, ...p } })),
    }),
    {
      name: 'kot:app',
      version: 2,
      migrate: (old) => {
        const o = old as Partial<AppState> & { favorites?: string[]; look?: Partial<ChartLook> & { grid?: boolean } }
        const grid = o.look?.grid ?? true
        return { ...o, look: { ...DEFAULT_LOOK, gridH: grid, gridV: grid, ...o.look }, listIdx: o.listIdx ?? 0, lists: o.lists ?? [{ name: 'Favoriler', symbols: o.favorites ?? DEFAULT_LIST.symbols }], panes: [...(o.panes ?? []), ...PANES].slice(0, PANES.length) } as AppState
      },
      partialize: ({ prices: _p, watchSymbols: _w, snapshotAt: _s, cryptoCount: _c, editIndicator: _e, proxyDown: _d, txForm: _t, alertSymbol: _a, ...rest }) => rest,
    },
  ),
)

/** Etkin listenin bölüm başlıkları dahil tüm girdileri. */
export const useListEntries = () => useApp((s) => s.lists[s.listIdx]?.symbols ?? s.lists[0].symbols)
/** Etkin listedeki semboller (bölüm başlıkları hariç). */
export const useFavorites = () => {
  const entries = useListEntries()
  return useMemo(() => entries.filter((e) => !isSection(e)), [entries])
}
