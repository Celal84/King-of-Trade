import type { Candle, Quote, Timeframe } from '../types'
import { SYNTHETIC, type SyntheticDef } from '../data/symbols'
import { YahooAdapter } from './YahooAdapter'

const apply = (d: SyntheticDef, a: number, b: number) => (d.op === 'mul' ? (a * b) / d.k : a / b / d.k)

function combine(d: SyntheticDef, as: Candle[], bs: Candle[]): Candle[] {
  const out: Candle[] = []
  let j = 0
  for (const a of as) {
    while (j + 1 < bs.length && bs[j + 1].timestamp <= a.timestamp) j++
    const b = bs[j]
    if (!b || b.timestamp > a.timestamp) continue
    const o = apply(d, a.open, b.open)
    const c = apply(d, a.close, b.close)
    const x = apply(d, a.high, d.op === 'mul' ? b.high : b.low)
    const y = apply(d, a.low, d.op === 'mul' ? b.low : b.high)
    out.push({ timestamp: a.timestamp, open: o, close: c, high: Math.max(o, c, x, y), low: Math.min(o, c, x, y), volume: a.volume })
  }
  return out
}

export const SyntheticAdapter = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const d = SYNTHETIC[symbol]
    const [as, bs] = await Promise.all([YahooAdapter.getCandles(d.a, tf), YahooAdapter.getCandles(d.b, tf)])
    return combine(d, as, bs)
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const defs = symbols.map((s) => [s, SYNTHETIC[s]] as const)
    const parts = await YahooAdapter.getQuotes([...new Set(defs.flatMap(([, d]) => [d.a, d.b]))])
    const out: Record<string, Quote> = {}
    for (const [s, d] of defs) {
      const a = parts[d.a]
      const b = parts[d.b]
      if (!a || !b) continue
      const ch = d.op === 'mul' ? (1 + a.change / 100) * (1 + b.change / 100) : (1 + a.change / 100) / (1 + b.change / 100)
      out[s] = { price: apply(d, a.price, b.price), change: (ch - 1) * 100 }
    }
    return out
  },
}
