import type { Candle, Ccy, Fundamentals, Quote, Source, Timeframe } from '../types'
import { getSymbol } from '../data/symbols'
import { BinanceAdapter } from './BinanceAdapter'
import { YahooAdapter } from './YahooAdapter'
import { SyntheticAdapter, combine } from './SyntheticAdapter'

const ADAPTERS = { binance: BinanceAdapter, yahoo: YahooAdapter, synthetic: SyntheticAdapter }
const POLL_MS = 30_000
type Base = 'TRY' | 'USD'
const FX: Record<Base, Partial<Record<Ccy, [string, 'mul' | 'div']>>> = {
  TRY: { USD: ['USDTRY=X', 'div'], EUR: ['EURTRY=X', 'div'] },
  USD: { TRY: ['USDTRY=X', 'mul'], EUR: ['EURUSD=X', 'div'] },
}

const baseOf = (symbol: string): Base => (getSymbol(symbol).currency === 'TRY' ? 'TRY' : 'USD')
const fxOf = (symbol: string, ccy: Ccy) => (symbol.endsWith('=X') ? undefined : FX[baseOf(symbol)][ccy])
const raw = (symbol: string, tf: Timeframe) => ADAPTERS[getSymbol(symbol).source].getCandles(symbol, tf)

export const MarketRouter = {
  /** Grafiğin gösterildiği para birimi (dönüşüm yoksa sembolün kendi birimi). */
  currencyOf: (symbol: string, ccy: Ccy = 'ORG'): string => (fxOf(symbol, ccy) ? ccy : getSymbol(symbol).currency),

  async getCandles(symbol: string, tf: Timeframe, ccy: Ccy = 'ORG'): Promise<Candle[]> {
    const fx = fxOf(symbol, ccy)
    if (!fx) return raw(symbol, tf)
    const [list, rates] = await Promise.all([raw(symbol, tf), YahooAdapter.getCandles(fx[0], tf)])
    return combine({ op: fx[1], k: 1 }, list, rates)
  },

  /** Her kaynağın fiyatları hazır oldukça `onPart` ile iletilir; yavaş bir kaynak diğerlerini bekletmez. */
  async streamQuotes(symbols: string[], onPart: (q: Record<string, Quote>) => void): Promise<void> {
    const groups: Record<Source, string[]> = { binance: [], yahoo: [], synthetic: [] }
    for (const s of new Set(symbols)) groups[getSymbol(s).source].push(s)
    await Promise.all(
      (Object.keys(groups) as Source[]).filter((k) => groups[k].length).map((k) => ADAPTERS[k].getQuotes(groups[k]).then(onPart, () => undefined)),
    )
  },

  getFundamentals: (symbol: string): Promise<Fundamentals> => YahooAdapter.getFundamentals(symbol),

  subscribe(symbol: string, tf: Timeframe, cb: (c: Candle) => void, ccy: Ccy = 'ORG'): () => void {
    if (getSymbol(symbol).source === 'binance' && !fxOf(symbol, ccy)) return BinanceAdapter.subscribe(symbol, tf, cb)
    const id = setInterval(() => {
      if (document.hidden) return
      MarketRouter.getCandles(symbol, tf, ccy).then((l) => l.length && cb(l[l.length - 1])).catch(() => undefined)
    }, POLL_MS)
    return () => clearInterval(id)
  },
}
