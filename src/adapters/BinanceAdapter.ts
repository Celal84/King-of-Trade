import type { Candle, Quote, Timeframe } from '../types'
import { cached, workerUrl } from './http'
import { aggregate, bucket } from '../lib/candles'

export interface Ticker extends Quote {
  volume: number
}
const BULK = 40

const HOSTS = ['https://api.binance.com', 'https://data-api.binance.vision']
const WS = 'wss://stream.binance.com:9443/ws'
const POLL_MS = 15_000
let direct = true

async function fetchJson<T>(url: string): Promise<[T, number]> {
  const r = await fetch(url, { signal: AbortSignal.timeout(url.includes('/crypto?') ? 15_000 : 6_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return [(await r.json()) as T, +(r.headers.get('x-kot-pct') ?? 1)]
}

/** Önce Binance'e doğrudan gider; ağ Binance'i engelliyorsa kendi Worker'ımız üzerinden (Binance, olmazsa MEXC) alır.
 *  Dönen ikinci değer, değişim yüzdesi alanının çarpanıdır. */
async function get<T>(path: string): Promise<[T, number]> {
  let err: unknown
  const worker = workerUrl()
  const urls = [...(direct ? HOSTS.map((h) => `${h}/api/v3${path}`) : []), ...(worker ? [`${worker}/crypto?path=${encodeURIComponent(path)}`] : [])]
  for (const [i, url] of urls.entries()) {
    try {
      const out = await fetchJson<T>(url)
      // Doğrudan erişim bir kez başarısız olup Worker çalıştıysa sonraki isteklerde boşuna beklenmez
      if (direct && worker && i === urls.length - 1) direct = false
      return out
    } catch (e) {
      err = e
    }
  }
  throw err instanceof Error ? err : new Error('Kripto verisi alınamadı')
}

type RawKline = [number, string, string, string, string, string]
const toCandle = (k: RawKline): Candle => ({ timestamp: k[0], open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] })

export const BinanceAdapter = {
  async getCandles(symbol: string, tf: Timeframe): Promise<Candle[]> {
    const load = async (interval: string) => (await get<RawKline[]>(`/klines?symbol=${symbol}&interval=${interval}&limit=1000`))[0].map(toCandle)
    // Yedek kaynakta 2 saatlik aralık yok: saatlik mumlar birleştirilir
    const hourly = async () => aggregate(await load('1h'), bucket(2 * 3600_000))
    if (tf !== '2h') return load(tf)
    return direct ? load(tf).catch(hourly) : hourly()
  },

  /** Tüm Binance spot pariteleri: fiyat, 24s değişim ve işlem hacmi (karşı para cinsinden). */
  allTickers: (): Promise<Record<string, Ticker>> =>
    // Yedek yolda (Worker üzerinden) tüm liste büyük bir yanıttır; dakikada bir yenilenir
    cached('binance:tickers', direct ? 20_000 : 60_000, async () => {
      const [raw, pct] = await get<{ symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string }[]>('/ticker/24hr')
      return Object.fromEntries(raw.map((t) => [t.symbol, { price: +t.lastPrice, change: +t.priceChangePercent * pct, volume: +t.quoteVolume }]))
    }),

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    if (!symbols.length) return {}
    if (symbols.length > BULK || !direct) {
      const all = await BinanceAdapter.allTickers()
      return Object.fromEntries(symbols.filter((s) => all[s]).map((s) => [s, all[s]]))
    }
    try {
      const [raw, pct] = await get<{ symbol: string; lastPrice: string; priceChangePercent: string }[]>(`/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`)
      return Object.fromEntries(raw.map((t) => [t.symbol, { price: +t.lastPrice, change: +t.priceChangePercent * pct }]))
    } catch {
      // Yedek kaynak çoklu sembol sorgusunu desteklemez: tüm pariteler listesinden alınır
      const all = await BinanceAdapter.allTickers()
      return Object.fromEntries(symbols.filter((s) => all[s]).map((s) => [s, all[s]]))
    }
  },

  /** Canlı mum akışı: WebSocket açılamazsa (ağ engeli) son mum periyodik olarak yoklanır. */
  subscribe(symbol: string, tf: Timeframe, cb: (c: Candle) => void): () => void {
    let ws: WebSocket | null = null
    let closed = false
    let opened = false
    let retry: ReturnType<typeof setTimeout>
    let poll: ReturnType<typeof setInterval> | undefined
    const startPolling = () => {
      poll ??= setInterval(() => {
        if (!document.hidden) BinanceAdapter.getCandles(symbol, tf).then((l) => l.length && cb(l[l.length - 1])).catch(() => undefined)
      }, POLL_MS)
    }
    const open = () => {
      ws = new WebSocket(`${WS}/${symbol.toLowerCase()}@kline_${tf}`)
      ws.onopen = () => (opened = true)
      ws.onmessage = (e) => {
        const k = JSON.parse(e.data as string).k
        cb({ timestamp: k.t, open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v })
      }
      ws.onclose = () => {
        if (closed) return
        if (opened) retry = setTimeout(open, 3000)
        else startPolling()
      }
    }
    open()
    return () => {
      closed = true
      clearTimeout(retry)
      clearInterval(poll)
      ws?.close()
    }
  },
}
