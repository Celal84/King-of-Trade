import type { Category, Currency, Source, SymbolInfo } from '../types'
import bist from './bist.json'
import { EMTIA, INDICES, KRIPTO, SENTETIK } from './markets'

export { SYNTHETIC, INDICES } from './markets'
export type { SyntheticDef } from './markets'

const SECTOR_TR: Record<string, string> = {
  Finance: 'Finans', 'Electronic Technology': 'Elektronik Teknoloji', 'Technology Services': 'Teknoloji Hizmetleri', 'Process Industries': 'Proses Sanayi',
  'Non-Energy Minerals': 'Maden ve Metal', 'Producer Manufacturing': 'İmalat', 'Consumer Non-Durables': 'Dayanıksız Tüketim',
  'Consumer Durables': 'Dayanıklı Tüketim', 'Consumer Services': 'Tüketici Hizmetleri', 'Retail Trade': 'Perakende', Utilities: 'Enerji Dağıtım',
  'Energy Minerals': 'Enerji', Transportation: 'Ulaştırma', 'Industrial Services': 'Sanayi Hizmetleri', 'Distribution Services': 'Dağıtım',
  'Health Technology': 'Sağlık Teknolojisi', 'Health Services': 'Sağlık Hizmetleri', Communications: 'İletişim', 'Commercial Services': 'Ticari Hizmetler',
  Miscellaneous: 'Diğer',
}

const mk = (symbol: string, name: string, category: Category, source: Source, currency: Currency, sector?: string): SymbolInfo =>
  ({ symbol, name, category, source, currency, sector })

const universe = bist as unknown as { idx: Record<string, string[]>; s: [string, string, string | null][] }

export const INDEX_MEMBERS: Record<string, Set<string>> = Object.fromEntries(Object.entries(universe.idx).map(([k, v]) => [k, new Set(v.map((c) => `${c}.IS`))]))
export const INDEX_LIST = INDICES.filter(([c]) => INDEX_MEMBERS[c])
export const indicesOf = (symbol: string) => INDEX_LIST.filter(([c]) => INDEX_MEMBERS[c].has(symbol)).map(([c]) => c)
const top = INDEX_MEMBERS.XU100 ?? new Set<string>()

export const SYMBOLS: SymbolInfo[] = [
  ...INDICES.map(([c, n]) => mk(`${c}.IS`, n, 'BIST', 'yahoo', 'TRY', 'Endeks')),
  ...universe.s.map(([c, n, s]) => mk(`${c}.IS`, n, 'BIST', 'yahoo', 'TRY', SECTOR_TR[s ?? ''] ?? s ?? 'Diğer')).sort((a, b) => +top.has(b.symbol) - +top.has(a.symbol)),
  ...EMTIA.map(([c, n, cur]) => mk(c, n, 'EMTIA', 'yahoo', cur)),
  ...SENTETIK.map(([c, n, cur]) => mk(c, n, 'SENTETIK', 'synthetic', cur)),
  ...KRIPTO.map((c) => mk(c, c.replace(/(USDT|TRY)$/, '/$1'), 'KRIPTO', 'binance', c.endsWith('TRY') ? 'TRY' : 'USDT')),
]

const BY_SYMBOL = new Map(SYMBOLS.map((s) => [s.symbol, s]))

export const getSymbol = (symbol: string): SymbolInfo =>
  BY_SYMBOL.get(symbol) ?? mk(symbol, symbol, 'BIST', 'yahoo', 'TRY')

export const isIndex = (symbol: string) => getSymbol(symbol).sector === 'Endeks'

export const CATEGORIES: { key: Category | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' }, { key: 'BIST', label: 'BIST' }, { key: 'EMTIA', label: 'Emtia & Döviz' },
  { key: 'SENTETIK', label: 'Sentetik' }, { key: 'KRIPTO', label: 'Kripto' },
]

export const displayName = (symbol: string) => symbol.replace(/\.IS$/, '')

export const fold = (s: string) => s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '')
