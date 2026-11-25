import type { Candle, Fundamentals, Quote, Timeframe } from '../types'
import { aggregate } from '../lib/candles'
import { useApp } from '../store/app'
import { cached, getJson } from './http'

const BASE: string = import.meta.env.VITE_SNAPSHOT_URL || './data/'
const TTL = 60_000
const HOUR = 3600_000
const DAY = 24 * HOUR
// [dosya aralığı, birleştirme süresi, kaydırma] — hafta pazartesi başlar (epoch perşembe)
const SOURCE: Record<Timeframe, [string, number?, number?]> = {
  '1m': ['1m'], '5m': ['5m'], '15m': ['5m', 15 * 60_000], '1h': ['60m'], '4h': ['60m', 4 * HOUR], '1d': ['1d'], '1w': ['1d', 7 * DAY, 4 * DAY],
}

interface ChartFile { t: number; m: [number, number, number, string]; k: [number, number, number, number, number, number][] }
interface QuoteFile { t: number; q: Record<string, [number, number]> }
interface FundFile { t: number; f: Record<string, [number | null, number | null, number | null]> }

const safe = (s: string) => s.replace(/[^A-Za-z0-9]/g, '_')

async function load<T extends { t: number }>(path: string): Promise<T> {
  const bust = Math.floor(Date.now() / 120_000)
  const f = await cached(`snap:${path}`, TTL, () => getJson(`${BASE}${path}?v=${bust}`) as Promise<T>)
  if (useApp.getState().snapshotAt !== f.t) useApp.getState().set({ snapshotAt: f.t })
  return f
}

const chartFile = (symbol: string, interval: string) => load<ChartFile>(`c/${safe(symbol)}_${interval}.json`)

export const Snapshot = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const [interval, ms, offset] = SOURCE[tf]
    const f = await chartFile(symbol, interval)
    const list = f.k.map(([t, open, high, low, close, volume]) => ({ timestamp: t * 1000, open, high, low, close, volume }))
    return ms ? aggregate(list, ms, offset) : list
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const { q } = await load<QuoteFile>('quotes.json')
    return Object.fromEntries(symbols.filter((s) => q[s]).map((s) => [s, { price: q[s][0], change: q[s][1] }]))
  },

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const [fund, chart] = await Promise.all([load<FundFile>('fund.json').catch(() => null), chartFile(symbol, '1d')])
    const [pe, pb, marketCap] = fund?.f[symbol] ?? []
    const [price, high52, low52, currency] = chart.m
    return { pe: pe ?? undefined, pb: pb ?? undefined, marketCap: marketCap ?? undefined, price, high52, low52, currency }
  },
}
