import type { Quote } from '../types'
import { cached } from './http'

// Fiyatlar doğrudan tarayıcıdan, tek istekte alınır (Worker kotası harcanmaz). Resmî olmayan bir uçtur;
// yanıt vermezse çağıran taraf Yahoo/Worker yoluna düşer. BIST ve vadeli emtia verisi kaynağında gecikmelidir.
const URL = 'https://scanner.tradingview.com/global/scan'
const TTL = 1_500
const PAUSE_MS = 60_000
const BIST = '.IS'
// Yahoo sembolü → tarama kaynağındaki karşılığı
const MAP: Record<string, string> = {
  'USDTRY=X': 'FX_IDC:USDTRY', 'EURTRY=X': 'FX_IDC:EURTRY', 'GBPTRY=X': 'FX_IDC:GBPTRY', 'EURUSD=X': 'FX_IDC:EURUSD',
  'GC=F': 'COMEX:GC1!', 'SI=F': 'COMEX:SI1!', 'PL=F': 'NYMEX:PL1!', 'PA=F': 'NYMEX:PA1!', 'BZ=F': 'NYMEX:BZ1!', 'CL=F': 'NYMEX:CL1!',
  'NG=F': 'NYMEX:NG1!', 'HG=F': 'COMEX:HG1!', 'ZW=F': 'CBOT:ZW1!', 'ZC=F': 'CBOT:ZC1!', 'KC=F': 'ICEUS:KC1!', 'CT=F': 'ICEUS:CT1!',
  'DX-Y.NYB': 'TVC:DXY', '^GSPC': 'SP:SPX', '^IXIC': 'NASDAQ:IXIC', '^GDAXI': 'XETR:DAX',
}
const ticker = (symbol: string) => (symbol.endsWith(BIST) ? `BIST:${symbol.slice(0, -BIST.length)}` : MAP[symbol])
let pausedUntil = 0

async function scan(symbols: string[]): Promise<Record<string, Quote>> {
  const back = new Map(symbols.map((s) => [ticker(s), s]))
  // Gövde düz metin gönderilir: tarayıcı ön kontrol (preflight) isteği yapmaz
  const r = await fetch(URL, {
    method: 'POST',
    body: JSON.stringify({ symbols: { tickers: [...back.keys()] }, columns: ['close', 'change'] }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = (await r.json()) as { data?: { s: string; d: [number | null, number | null] }[] }
  const out: Record<string, Quote> = {}
  for (const x of j.data ?? []) {
    const symbol = back.get(x.s)
    if (symbol && x.d[0] != null) out[symbol] = { price: x.d[0], change: x.d[1] ?? 0 }
  }
  return out
}

export const ScannerAdapter = {
  /** Bu sembol tarama kaynağından alınabilir mi (ve kaynak şu an duraklatılmamış mı)? */
  supports: (symbol: string) => Date.now() >= pausedUntil && !!ticker(symbol),
  getQuotes: (symbols: string[]): Promise<Record<string, Quote>> => {
    const list = [...symbols].sort()
    return cached(`scan:${list.join(',')}`, TTL, () =>
      scan(list).catch((e) => {
        // Hata veya hız sınırı: bir dakika boyunca istek gönderilmez, çağıranlar yedek yola düşer
        pausedUntil = Date.now() + PAUSE_MS
        throw e
      }))
  },
}
