import { getSymbol } from '../data/symbols'

/** Piyasa şu an açık mı (BIST: hafta içi 10:00–18:10 TSİ; kripto: her zaman; diğerleri: hafta içi). */
export function marketOpen(symbol: string): boolean {
  if (getSymbol(symbol).source === 'binance') return true
  const tr = new Date(Date.now() + 3 * 3600_000)
  const weekday = tr.getUTCDay() % 6 !== 0
  const minutes = tr.getUTCHours() * 60 + tr.getUTCMinutes()
  return symbol.endsWith('.IS') ? weekday && minutes >= 600 && minutes <= 1090 : weekday
}
