import type { Candle, Fundamentals, Quote, Source, Timeframe } from '../types'
import { getSymbol } from '../data/symbols'
import { BinanceAdapter } from './BinanceAdapter'
import { YahooAdapter } from './YahooAdapter'
import { SyntheticAdapter } from './SyntheticAdapter'

const ADAPTERS = { binance: BinanceAdapter, yahoo: YahooAdapter, synthetic: SyntheticAdapter }
const POLL_MS = 30_000

export const MarketRouter = {
  getCandles: (symbol: string, tf: Timeframe): Promise<Candle[]> => ADAPTERS[getSymbol(symbol).source].getCandles(symbol, tf),

  /** Her kaynağın fiyatları hazır oldukça `onPart` ile iletilir; yavaş bir kaynak diğerlerini bekletmez. */
  async streamQuotes(symbols: string[], onPart: (q: Record<string, Quote>) => void): Promise<void> {
    const groups: Record<Source, string[]> = { binance: [], yahoo: [], synthetic: [] }
    for (const s of new Set(symbols)) groups[getSymbol(s).source].push(s)
    await Promise.all(
      (Object.keys(groups) as Source[]).filter((k) => groups[k].length).map((k) => ADAPTERS[k].getQuotes(groups[k]).then(onPart, () => undefined)),
    )
  },

  getFundamentals: (symbol: string): Promise<Fundamentals> => YahooAdapter.getFundamentals(symbol),

  subscribe(symbol: string, tf: Timeframe, cb: (c: Candle) => void): () => void {
    if (getSymbol(symbol).source === 'binance') return BinanceAdapter.subscribe(symbol, tf, cb)
    const id = setInterval(() => {
      MarketRouter.getCandles(symbol, tf).then((l) => l.length && cb(l[l.length - 1])).catch(() => undefined)
    }, POLL_MS)
    return () => clearInterval(id)
  },
}
