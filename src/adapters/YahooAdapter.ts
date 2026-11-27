import type { Candle, Fundamentals, Quote, Timeframe } from '../types'
import { aggregate, bucket, dropEmpty } from '../lib/candles'
import { hasLiveSource, proxiedJson } from './http'
import { Snapshot } from './snapshot'
import { useApp } from '../store/app'

const BASE = 'https://query1.finance.yahoo.com'
const H = 3600_000
const PARAMS: Record<Timeframe, [string, string, number?]> = {
  '1m': ['1m', '5d'], '5m': ['5m', '1mo'], '15m': ['15m', '1mo'], '30m': ['30m', '1mo'], '1h': ['60m', '6mo'], '2h': ['60m', '6mo', 2 * H],
  '4h': ['60m', '1y', 4 * H], '1d': ['1d', '10y'], '1w': ['1wk', 'max'], '1M': ['1mo', 'max'],
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
  const j = await proxiedJson<ChartResp>(chartUrl(symbol, interval, range), 6_000)
  const r = j.chart.result?.[0]
  if (!r) throw new Error(`${symbol}: veri yok`)
  return r
}

async function withFallback<T>(live: () => Promise<T>, snap: () => Promise<T>, valid: (v: T) => boolean = () => true): Promise<T> {
  const liveFirst = hasLiveSource()
  const [first, second] = liveFirst ? [live, snap] : [snap, live]
  const markLive = (isLive: boolean) => isLive && useApp.getState().snapshotAt !== null && useApp.getState().set({ snapshotAt: null })
  try {
    const v = await first()
    if (!valid(v)) throw new Error('boş')
    markLive(liveFirst)
    return v
  } catch {
    const v = await second()
    markLive(!liveFirst)
    return v
  }
}

const Live = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const [interval, range, agg] = PARAMS[tf]
    const r = await chart(symbol, interval, range)
    const q = r.indicators.quote[0]
    const out: Candle[] = []
    const ts = r.timestamp ?? []
    ts.forEach((t, i) => {
      const [o, h, l] = [q.open[i], q.high[i], q.low[i]]
      const c = q.close[i] ?? (i === ts.length - 1 ? r.meta.regularMarketPrice : null)
      if (o == null || h == null || l == null || c == null) return
      out.push({ timestamp: t * 1000, open: o, high: Math.max(h, c), low: Math.min(l, c), close: c, volume: q.volume[i] ?? 0 })
    })
    const list = dropEmpty(symbol, interval, out)
    return agg ? aggregate(list, bucket(agg)) : list
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const out: Record<string, Quote> = {}
    for (let i = 0; i < symbols.length; i += 20) {
      const batch = symbols.slice(i, i + 20)
      try {
        const j = await proxiedJson<SparkResp>(`${BASE}/v7/finance/spark?symbols=${batch.map(encodeURIComponent).join(',')}&range=1d&interval=1d`, 4_000)
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

const BULK = 40
const ROTATE_MAX = 200
let cursor = 0
let seeded = ''

/** Uzun listelerde her çağrıda sıradaki 40 sembol canlı yenilenir; ilk çağrıda tüm liste anlık görüntüden doldurulur.
 *  Böylece istek sayısı sabit kalırken listedeki fiyatlar sürekli güncellenir. */
async function rotating(symbols: string[]): Promise<Record<string, Quote>> {
  const window = Array.from({ length: BULK }, (_, i) => symbols[(cursor + i) % symbols.length])
  cursor = (cursor + BULK) % symbols.length
  const live = Live.getQuotes(window)
  const key = `${symbols.length}:${symbols[0]}`
  if (seeded === key) return live
  seeded = key
  const [snap, fresh] = await Promise.all([Snapshot.getQuotes(symbols).catch(() => ({})), live])
  return { ...snap, ...fresh }
}
const notEmpty = (v: object) => (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0)

export const YahooAdapter = {
  getCandles: (symbol: string, tf: Timeframe): Promise<Candle[]> =>
    withFallback(() => Live.getCandles(symbol, tf), () => Snapshot.getCandles(symbol, tf), notEmpty),
  getQuotes: (symbols: string[]): Promise<Record<string, Quote>> => {
    if (symbols.length <= BULK) return withFallback(() => Live.getQuotes(symbols), () => Snapshot.getQuotes(symbols), notEmpty)
    if (!hasLiveSource() || symbols.length > ROTATE_MAX) return Snapshot.getQuotes(symbols).catch(() => Live.getQuotes(symbols))
    return rotating(symbols)
  },
  getFundamentals: (symbol: string): Promise<Fundamentals> =>
    Snapshot.getFundamentals(symbol).catch(() => Live.getFundamentals(symbol)),
}
