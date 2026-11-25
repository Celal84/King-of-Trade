import type { Candle } from '../types'

export function heikinAshi(list: Candle[]): Candle[] {
  const out: Candle[] = []
  list.forEach((c, i) => {
    const close = (c.open + c.high + c.low + c.close) / 4
    const open = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2
    out.push({ ...c, open, close, high: Math.max(c.high, open, close), low: Math.min(c.low, open, close) })
  })
  return out
}

export type Bucket = (timestamp: number) => number
export const bucket = (ms: number, offset = 0): Bucket => (t) => Math.floor((t - offset) / ms) * ms + offset
export const monthBucket: Bucket = (t) => {
  const d = new Date(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

export function aggregate(list: Candle[], by: Bucket): Candle[] {
  const out: Candle[] = []
  for (const c of list) {
    const t = by(c.timestamp)
    const last = out[out.length - 1]
    if (last && last.timestamp === t) {
      last.high = Math.max(last.high, c.high)
      last.low = Math.min(last.low, c.low)
      last.close = c.close
      last.volume += c.volume
    } else out.push({ ...c, timestamp: t })
  }
  return out
}

export function mergeCandle(list: Candle[], c: Candle): Candle[] {
  const last = list[list.length - 1]
  if (!last || c.timestamp > last.timestamp) return [...list, c]
  if (c.timestamp === last.timestamp) return [...list.slice(0, -1), c]
  return list
}

export function rsi(closes: number[], period = 14): number | undefined {
  if (closes.length <= period) return undefined
  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gain += d
    else loss -= d
  }
  gain /= period
  loss /= period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
}

export const fmt = (v: number | undefined, d?: number) => {
  if (v === undefined || !isFinite(v)) return '—'
  if (Math.abs(v) < 1e-9) v = 0
  const digits = d ?? (Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 2 : 6)
  return v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export const fmtBig = (v: number | undefined) => {
  if (v === undefined) return '—'
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'Mr'], [1e6, 'Mn'], [1e3, 'B']]
  const u = units.find(([n]) => Math.abs(v) >= n)
  return u ? `${fmt(v / u[0], 2)} ${u[1]}` : fmt(v, 2)
}
