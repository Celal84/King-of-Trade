import type { Quote } from '../types'
import { cached } from './http'

// BIST fiyatları doğrudan tarayıcıdan, tek istekte alınır (Worker kotası harcanmaz). Resmî olmayan bir uçtur;
// yanıt vermezse çağıran taraf Yahoo/Worker yoluna düşer. Veri kaynağında yaklaşık 15 dakika gecikmelidir.
const URL = 'https://scanner.tradingview.com/turkey/scan'
const TTL = 4_000
const SUFFIX = '.IS'

export const isBist = (symbol: string) => symbol.endsWith(SUFFIX)

async function scan(symbols: string[]): Promise<Record<string, Quote>> {
  // Gövde düz metin gönderilir: tarayıcı ön kontrol (preflight) isteği yapmaz
  const r = await fetch(URL, {
    method: 'POST',
    body: JSON.stringify({ symbols: { tickers: symbols.map((s) => `BIST:${s.slice(0, -SUFFIX.length)}`) }, columns: ['close', 'change'] }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = (await r.json()) as { data?: { s: string; d: [number | null, number | null] }[] }
  const out: Record<string, Quote> = {}
  for (const x of j.data ?? []) if (x.d[0] != null) out[`${x.s.slice(5)}${SUFFIX}`] = { price: x.d[0], change: x.d[1] ?? 0 }
  return out
}

export const ScannerAdapter = {
  getQuotes: (symbols: string[]): Promise<Record<string, Quote>> => {
    const list = [...symbols].sort()
    return cached(`scan:${list.join(',')}`, TTL, () => scan(list))
  },
}
