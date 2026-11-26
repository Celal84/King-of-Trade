import type { Candle } from '../types'

export type SeriesType = 'close' | 'ema' | 'sma' | 'rsi' | 'macd' | 'signal' | 'const'
export type RuleOp = '>' | '<' | 'cross_up' | 'cross_down'
/** n: periyot (const için sabit değer). */
export interface Operand { type: SeriesType; n: number }
export interface Rule { a: Operand; op: RuleOp; b: Operand }
export interface Strategy { entry: Rule; exit: Rule | null; fee: number }
export interface Trade { inAt: number; outAt: number; inPrice: number; outPrice: number; pnl: number; open?: boolean }
export interface Result { trades: Trade[]; total: number; buyHold: number; winRate: number; maxDrawdown: number; bars: number }

export const SERIES_LABEL: Record<SeriesType, string> = { close: 'Fiyat', ema: 'EMA', sma: 'SMA', rsi: 'RSI', macd: 'MACD', signal: 'MACD Sinyal', const: 'Sabit değer' }
export const OP_LABEL: Record<RuleOp, string> = { '>': '>', '<': '<', cross_up: 'yukarı keser', cross_down: 'aşağı keser' }
export const hasParam = (t: SeriesType) => t === 'ema' || t === 'sma' || t === 'rsi' || t === 'const'
const REVERSE: Record<RuleOp, RuleOp> = { '>': '<', '<': '>', cross_up: 'cross_down', cross_down: 'cross_up' }
export const reverse = (r: Rule): Rule => ({ ...r, op: REVERSE[r.op] })

function ema(v: number[], n: number): number[] {
  const k = 2 / (n + 1)
  const out: number[] = []
  let e = NaN
  let seen = 0
  for (const x of v) {
    if (!isNaN(x)) {
      e = seen === 0 ? x : x * k + e * (1 - k)
      seen++
    }
    out.push(seen >= n ? e : NaN)
  }
  return out
}

function sma(v: number[], n: number): number[] {
  let s = 0
  return v.map((x, i) => {
    s += x - (i >= n ? v[i - n] : 0)
    return i >= n - 1 ? s / n : NaN
  })
}

function rsi(v: number[], n: number): number[] {
  let gain = 0
  let loss = 0
  return v.map((x, i) => {
    if (i === 0) return NaN
    const d = x - v[i - 1]
    const w = Math.min(i, n)
    gain = (gain * (w - 1) + Math.max(d, 0)) / w
    loss = (loss * (w - 1) + Math.max(-d, 0)) / w
    return i < n ? NaN : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  })
}

function series(o: Operand, close: number[]): number[] {
  const n = Math.max(1, Math.round(o.n))
  switch (o.type) {
    case 'close': return close
    case 'const': return close.map(() => o.n)
    case 'ema': return ema(close, n)
    case 'sma': return sma(close, n)
    case 'rsi': return rsi(close, n)
    default: {
      const [fast, slow] = [ema(close, 12), ema(close, 26)]
      const macd = fast.map((x, i) => x - slow[i])
      return o.type === 'macd' ? macd : ema(macd, 9)
    }
  }
}

function signals(r: Rule, close: number[]): boolean[] {
  const [a, b] = [series(r.a, close), series(r.b, close)]
  return close.map((_, i) => {
    if (isNaN(a[i]) || isNaN(b[i])) return false
    if (r.op === '>') return a[i] > b[i]
    if (r.op === '<') return a[i] < b[i]
    if (i === 0 || isNaN(a[i - 1]) || isNaN(b[i - 1])) return false
    return r.op === 'cross_up' ? a[i - 1] <= b[i - 1] && a[i] > b[i] : a[i - 1] >= b[i - 1] && a[i] < b[i]
  })
}

/** Yalnızca alım yönlü test: sinyal mumunun kapanışında işlem, her iki yönde komisyon. */
export function runBacktest(candles: Candle[], s: Strategy): Result {
  const close = candles.map((c) => c.close)
  const [enter, leave] = [signals(s.entry, close), signals(s.exit ?? reverse(s.entry), close)]
  const fee = s.fee / 100
  const trades: Trade[] = []
  let equity = 1
  let peak = 1
  let maxDrawdown = 0
  let pos: { i: number; price: number; base: number } | null = null
  const closeTrade = (i: number, open = false) => {
    if (!pos) return
    const pnl = (close[i] * (1 - fee)) / (pos.price * (1 + fee)) - 1
    equity = pos.base * (1 + pnl)
    trades.push({ inAt: candles[pos.i].timestamp, outAt: candles[i].timestamp, inPrice: pos.price, outPrice: close[i], pnl: pnl * 100, open })
    pos = null
  }
  for (let i = 0; i < close.length; i++) {
    if (pos && leave[i]) closeTrade(i)
    else if (!pos && enter[i] && !leave[i]) pos = { i, price: close[i], base: equity }
    const mark: number = pos ? pos.base * ((close[i] * (1 - fee)) / (pos.price * (1 + fee))) : equity
    peak = Math.max(peak, mark)
    maxDrawdown = Math.max(maxDrawdown, (1 - mark / peak) * 100)
  }
  closeTrade(close.length - 1, true)
  const wins = trades.filter((t) => t.pnl > 0).length
  return {
    trades, bars: close.length, maxDrawdown,
    total: (equity - 1) * 100,
    buyHold: close.length ? (close[close.length - 1] / close[0] - 1) * 100 : 0,
    winRate: trades.length ? (wins / trades.length) * 100 : 0,
  }
}
