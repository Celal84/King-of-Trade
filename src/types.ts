export type Category = 'BIST' | 'EMTIA' | 'SENTETIK' | 'KRIPTO'
export type Source = 'binance' | 'yahoo' | 'synthetic'
export type Currency = 'TRY' | 'USD' | 'USDT'
export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w'
export type CandleKind = 'candle' | 'hollow' | 'heikin' | 'line' | 'area'
export type Layout = '1x1' | '1x2' | '2x2'

export interface SymbolInfo {
  symbol: string
  name: string
  category: Category
  source: Source
  currency: Currency
  sector?: string
}

export interface Candle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Quote {
  price: number
  change: number
}

export interface Fundamentals {
  pe?: number
  pb?: number
  marketCap?: number
  high52?: number
  low52?: number
  price?: number
  currency?: string
}

export const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']
