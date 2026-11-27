import type { Candle, Ccy, Fundamentals, Quote, Source, Timeframe } from '../types'
import { getSymbol } from '../data/symbols'
import { YahooAdapter } from './YahooAdapter'
import { SyntheticAdapter, combine, componentsOf, derive } from './SyntheticAdapter'
import { marketOpen } from '../lib/market'

const ADAPTERS = { yahoo: YahooAdapter, synthetic: SyntheticAdapter }
// Açık piyasada son mum sık yoklanır ki grafik sürekli aksın; kapalıyken seyrek
const POLL_MS = 8_000
const IDLE_EVERY = 8
const SLOW_EVERY = 4
const MAX_BACKOFF = 3
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
    const groups: Record<Source, string[]> = { yahoo: [], synthetic: [] }
    for (const s of new Set(symbols)) groups[getSymbol(s).source].push(s)
    // Yahoo sembolleri ile sentetiklerin bileşenleri tek istekte alınır; sentetik fiyatlar bu yanıttan türetilir
    const yahoo = [...new Set([...groups.yahoo, ...componentsOf(groups.synthetic)])]
    if (!yahoo.length) return
    await YahooAdapter.getQuotes(yahoo).then((q) => {
      onPart({ ...Object.fromEntries(groups.yahoo.filter((s) => q[s]).map((s) => [s, q[s]])), ...derive(groups.synthetic, q) })
    }, () => undefined)
  },

  getFundamentals: (symbol: string): Promise<Fundamentals> => YahooAdapter.getFundamentals(symbol),

  /** Son mumu yoklar. Kota için: arka plandaki paneller (`slow`) ve kapalı piyasalar seyrek yoklanır; mum değişmedikçe
   *  aralık 8 → 16 → 24 → 32 saniyeye uzar, değişince 8 saniyeye döner. */
  subscribe(symbol: string, tf: Timeframe, cb: (c: Candle) => void, ccy: Ccy = 'ORG', slow: () => boolean = () => false): () => void {
    let tick = 0
    let skip = 0
    let still = 0
    let last = ''
    const id = setInterval(() => {
      tick++
      if (document.hidden || (!marketOpen(symbol) && tick % IDLE_EVERY) || (slow() && tick % SLOW_EVERY) || skip-- > 0) return
      MarketRouter.getCandles(symbol, tf, ccy).then((l) => {
        const c = l[l.length - 1]
        if (!c) return
        const sig = `${c.timestamp}:${c.close}:${c.volume}`
        still = sig === last ? Math.min(still + 1, MAX_BACKOFF) : 0
        skip = still
        last = sig
        cb(c)
      }).catch(() => undefined)
    }, POLL_MS)
    return () => clearInterval(id)
  },
}
