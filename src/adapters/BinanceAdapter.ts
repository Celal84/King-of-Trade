import type { Candle, Quote, Timeframe } from '../types'
import { cached } from './http'

export interface Ticker extends Quote {
  volume: number
}
const BULK = 40

const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision']
const WS = 'wss://stream.binance.com:9443/ws'

async function get<T>(path: string): Promise<T> {
  let err: unknown
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + path, { signal: AbortSignal.timeout(10_000) })
      if (r.ok) return (await r.json()) as T
      err = new Error(`HTTP ${r.status}`)
    } catch (e) {
      err = e
    }
  }
  throw err instanceof Error ? err : new Error('Binance hatası')
}

type RawKline = [number, string, string, string, string, string]
const toCandle = (k: RawKline): Candle => ({ timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })

export const BinanceAdapter = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const raw = await get<RawKline[]>(`/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=1000`)
    return raw.map(toCandle)
  },

  /** Tüm Binance spot pariteleri: fiyat, 24s değişim ve işlem hacmi (karşı para cinsinden). */
  allTickers: (): Promise<Record<string, Ticker>> =>
    cached('binance:tickers', 20_000, async () => {
      const raw = await get<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }[]>('/api/v3/ticker/24hr')
      return Object.fromEntries(raw.map((t) => [t.symbol, { price: +t.lastPrice, change: +t.priceChangePercent, volume: +t.quoteVolume }]))
    }),

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    if (!symbols.length) return {}
    if (symbols.length > BULK) {
      const all = await BinanceAdapter.allTickers()
      return Object.fromEntries(symbols.filter((s) => all[s]).map((s) => [s, all[s]]))
    }
    const raw = await get<{ symbol: string; lastPrice: string; priceChangePercent: string }[]>(
      `/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
    )
    return Object.fromEntries(raw.map((t) => [t.symbol, { price: +t.lastPrice, change: +t.priceChangePercent }]))
  },

  subscribe(symbol: string, tf: Timeframe, cb: (c: Candle) => void): () => void {
    let ws: WebSocket | null = null
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    const open = () => {
      ws = new WebSocket(`${WS}/${symbol.toLowerCase()}@kline_${tf}`)
      ws.onmessage = (e) => {
        const k = JSON.parse(e.data as string).k
        cb({ timestamp: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v })
      }
      ws.onclose = () => {
        if (!closed) retry = setTimeout(open, 3000)
      }
    }
    open()
    return () => {
      closed = true
      clearTimeout(retry)
      ws?.close()
    }
  },
}
