import type { Candle, Fundamentals, Quote, Timeframe, Universe } from '../types'
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
    // 1 dakikalık dosya yalnızca endeksler, BIST 100 ve emtia için üretilir; yoksa 5 dakikalığa düşülür
    const f = await chartFile(symbol, interval).catch((e) => (interval === '1m' ? chartFile(symbol, '5m') : Promise.reject(e)))
    const list = f.k.map(([t, open, high, low, close, volume]) => ({ timestamp: t * 1000, open, high, low, close, volume }))
    return ms ? aggregate(list, ms, offset) : list
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const { q } = await load<QuoteFile>('quotes.json')
    return Object.fromEntries(symbols.filter((s) => q[s]).map((s) => [s, { price: q[s][0], change: q[s][1] }]))
  },

  getUniverse: (): Promise<Universe> => load<Universe>('bist.json'),

  async getFundamentals(symbol: string): Promise<Fundamentals> {
    const [uni, chart] = await Promise.all([Snapshot.getUniverse().catch(() => null), chartFile(symbol, '1d').catch(() => null)])
    const row = uni?.s[symbol.replace(/\.IS$/, '')]
    const stats = row && uni ? Object.fromEntries(uni.cols.map((c, i) => [c, row[i]])) : undefined
    if (!stats && !chart) throw new Error('temel veri yok')
    const pick = (k: string) => stats?.[k] ?? undefined
    return {
      pe: pick('price_earnings_ttm'), pb: pick('price_book_fq'), marketCap: pick('market_cap_basic'),
      price: chart?.m[0] ?? pick('close'), high52: pick('price_52_week_high') ?? chart?.m[1], low52: pick('price_52_week_low') ?? chart?.m[2],
      currency: chart?.m[3] ?? 'TRY', stats,
    }
  },
}
