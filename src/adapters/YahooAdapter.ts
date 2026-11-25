import type { Candle, Fundamentals, Quote, Timeframe } from '../types'
import { aggregate } from '../lib/candles'
import { proxiedJson } from './http'

const BASE = 'https://query1.finance.yahoo.com'
const PARAMS: Record<Timeframe, [string, string]> = {
  '1m': ['1m', '5d'], '5m': ['5m', '1mo'], '15m': ['15m', '1mo'], '1h': ['60m', '6mo'],
  '4h': ['60m', '1y'], '1d': ['1d', '5y'], '1w': ['1wk', '10y'],
}

interface ChartMeta {
  regularMarketPrice?: number
  chartPreviousClose?: number
  regularMarketChangePercent?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  currency?: string
}
interface ChartResp {
  chart: {
    result?: {
      meta: ChartMeta
      timestamp?: number[]
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] }
    }[]
  }
}
interface SparkResp { spark: { result?: { symbol: string; response: { meta: ChartMeta }[] }[] } }
interface TsResp { timeseries: { result?: (Record<string, { reportedValue?: { raw: number } }[] | unknown> & { meta: { type: string[] } })[] } }

const chartUrl = (s: string, interval: string, range: string) =>
  `${BASE}/v8/finance/chart/${encodeURIComponent(s)}?interval=${interval}&range=${range}&includePrePost=false`

async function chart(symbol: string, interval: string, range: string) {
  const j = await proxiedJson<ChartResp>(chartUrl(symbol, interval, range))
  const r = j.chart.result?.[0]
  if (!r) throw new Error(`${symbol}: veri yok`)
  return r
}

export const YahooAdapter = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const [interval, range] = PARAMS[tf]
    const r = await chart(symbol, interval, range)
    const q = r.indicators.quote[0]
    const out: Candle[] = []
    ;(r.timestamp ?? []).forEach((t, i) => {
      const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]]
      if (o == null || h == null || l == null || c == null) return
      out.push({ timestamp: t * 1000, open: o, high: h, low: l, close: c, volume: q.volume[i] ?? 0 })
    })
    return tf === '4h' ? aggregate(out, 4 * 3600_000) : out
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const out: Record<string, Quote> = {}
    for (let i = 0; i < symbols.length; i += 20) {
      const batch = symbols.slice(i, i + 20)
      try {
        const j = await proxiedJson<SparkResp>(`${BASE}/v7/finance/spark?symbols=${batch.map(encodeURIComponent).join(',')}&range=1d&interval=1d`, 20_000)
        for (const r of j.spark.result ?? []) {
          const m = r.response[0]?.meta
          if (m?.regularMarketPrice == null) continue
          const prev = m.chartPreviousClose
          out[r.symbol] = { price: m.regularMarketPrice, change: m.regularMarketChangePercent ?? (prev ? (m.regularMarketPrice / prev - 1) * 100 : 0) }
        }
      } catch {
        /* sessiz: bir sonraki döngüde tekrar denenir */
      }
    }
    return out
  },

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const now = Math.floor(Date.now() / 1000)
    const types = ['trailingPeRatio', 'trailingPbRatio', 'trailingMarketCap']
    const [meta, ts] = await Promise.all([
      chart(symbol, '1d', '5d').then((r) => r.meta).catch(() => ({}) as ChartMeta),
      proxiedJson<TsResp>(`${BASE}/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${types.join(',')}&period1=${now - 86400 * 400}&period2=${now}`, 3600_000).catch(() => null),
    ])
    const last = (type: string) => {
      const r = ts?.timeseries.result?.find((x) => x.meta.type[0] === type)
      const arr = r?.[type] as { reportedValue?: { raw: number } }[] | undefined
      return arr?.filter(Boolean).at(-1)?.reportedValue?.raw
    }
    return {
      pe: last(types[0]), pb: last(types[1]), marketCap: last(types[2]),
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow, price: meta.regularMarketPrice, currency: meta.currency,
    }
  },
}
