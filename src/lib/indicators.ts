import { registerIndicator, type KLineData } from 'klinecharts'

type Row = Record<string, number | undefined>
type K = KLineData
const vol = (k: K) => k.volume ?? 0
const line = (key: string, title = `${key.toUpperCase()}: `) => ({ key, title, type: 'line' })

const sma = (v: number[], n: number) => v.map((_, i) => (i + 1 < n ? undefined : v.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n))
const ema = (v: number[], n: number) => {
  const k = 2 / (n + 1)
  let prev: number | undefined
  return v.map((x) => (prev = prev === undefined ? x : x * k + prev * (1 - k)))
}
const wma = (v: (number | undefined)[], n: number) =>
  v.map((_, i) => {
    if (i + 1 < n) return undefined
    let s = 0
    for (let j = 0; j < n; j++) {
      const x = v[i - j]
      if (x === undefined) return undefined
      s += x * (n - j)
    }
    return s / ((n * (n + 1)) / 2)
  })
const trueRange = (l: K[]) => l.map((k, i) => (i ? Math.max(k.high - k.low, Math.abs(k.high - l[i - 1].close), Math.abs(k.low - l[i - 1].close)) : k.high - k.low))
const rma = (v: number[], n: number) => {
  let prev: number | undefined
  let sum = 0
  return v.map((x, i) => {
    if (i < n) {
      sum += x
      return i === n - 1 ? (prev = sum / n) : undefined
    }
    return (prev = ((prev as number) * (n - 1) + x) / n)
  })
}
const highest = (l: K[], i: number, n: number) => Math.max(...l.slice(Math.max(0, i + 1 - n), i + 1).map((k) => k.high))
const lowest = (l: K[], i: number, n: number) => Math.min(...l.slice(Math.max(0, i + 1 - n), i + 1).map((k) => k.low))
const step = (l: K[]) => (l.length > 2 ? l[l.length - 1].timestamp - l[l.length - 2].timestamp : 86_400_000)
const DAY = 86_400_000

/** Pivot dönemi: TradingView "otomatik" kuralına yakın — gün içi kısa: günlük, saatlik: haftalık, günlük: aylık, üstü: yıllık. */
function periodKey(dt: number): (t: number) => string {
  if (dt <= 15 * 60_000) return (t) => new Date(t).toISOString().slice(0, 10)
  if (dt < DAY) return (t) => String(Math.floor((t - 4 * DAY) / (7 * DAY)))
  if (dt < 7 * DAY) return (t) => new Date(t).toISOString().slice(0, 7)
  return (t) => new Date(t).toISOString().slice(0, 4)
}

export const CUSTOM_MAIN = ['VWAP', 'SUPERTREND', 'ICHIMOKU', 'DONCHIAN', 'KELTNER', 'HMA', 'PIVOT', 'VPVR']
export const PARAM_HINTS: Record<string, string> = {
  PIVOT: 'Dönem: 0 otomatik · 1 günlük · 2 haftalık · 3 aylık · 4 yıllık',
  VPVR: 'Satır sayısı, mum sayısı (0 = ekranda görünen aralık; ör. 24, 200 = son 200 mum)',
  SUPERTREND: 'ATR periyodu, çarpan', ICHIMOKU: 'Tenkan, Kijun, Senkou B', KELTNER: 'Periyot, ATR çarpanı', STOCHRSI: 'RSI, Stokastik, %K, %D',
}
const PIVOT_KEYS = [undefined, 60_000, 3_600_000, DAY, 7 * DAY]

export const INDICATOR_LABELS: Record<string, string> = {
  VPVR: 'Hacim Profili (görünen aralık)', PIVOT: 'Pivot Noktaları Standart', CMF: 'Chaikin Money Flow', VWAP: 'VWAP', SUPERTREND: 'SuperTrend',
  ICHIMOKU: 'Ichimoku Bulutu', STOCHRSI: 'Stokastik RSI', MFI: 'Money Flow Index', DONCHIAN: 'Donchian Kanalı', KELTNER: 'Keltner Kanalı', HMA: 'Hull MA',
}

export function registerCustomIndicators() {
  registerIndicator<Row>({
    name: 'CMF', shortName: 'CMF', calcParams: [20], precision: 3, figures: [line('cmf')],
    calc: (l, ind) => {
      const n = ind.calcParams[0] as number
      const mfv = l.map((k) => (k.high === k.low ? 0 : ((k.close - k.low - (k.high - k.close)) / (k.high - k.low)) * vol(k)))
      return l.map((_, i) => {
        if (i + 1 < n) return {}
        let a = 0
        let b = 0
        for (let j = i + 1 - n; j <= i; j++) {
          a += mfv[j]
          b += vol(l[j])
        }
        return { cmf: b ? a / b : 0 }
      })
    },
  })

  registerIndicator<Row>({
    name: 'MFI', shortName: 'MFI', calcParams: [14], figures: [line('mfi')], minValue: 0, maxValue: 100,
    calc: (l, ind) => {
      const n = ind.calcParams[0] as number
      const tp = l.map((k) => (k.high + k.low + k.close) / 3)
      return l.map((_, i) => {
        if (i < n) return {}
        let pos = 0
        let neg = 0
        for (let j = i + 1 - n; j <= i; j++) {
          const f = tp[j] * vol(l[j])
          if (tp[j] > tp[j - 1]) pos += f
          else if (tp[j] < tp[j - 1]) neg += f
        }
        return { mfi: neg === 0 ? 100 : 100 - 100 / (1 + pos / neg) }
      })
    },
  })

  registerIndicator<Row>({
    name: 'STOCHRSI', shortName: 'StochRSI', calcParams: [14, 14, 3, 3], figures: [line('k'), line('d')], minValue: 0, maxValue: 100,
    calc: (l, ind) => {
      const [rn, sn, kn, dn] = ind.calcParams as number[]
      const ch = l.map((k, i) => (i ? k.close - l[i - 1].close : 0))
      const up = rma(ch.map((c) => Math.max(c, 0)), rn)
      const dn_ = rma(ch.map((c) => Math.max(-c, 0)), rn)
      const rsi = up.map((u, i) => (u === undefined || dn_[i] === undefined ? undefined : dn_[i] === 0 ? 100 : 100 - 100 / (1 + u / (dn_[i] as number))))
      const st = rsi.map((r, i) => {
        const w = rsi.slice(Math.max(0, i + 1 - sn), i + 1)
        if (r === undefined || w.length < sn || w.some((x) => x === undefined)) return 0
        const [lo, hi] = [Math.min(...(w as number[])), Math.max(...(w as number[]))]
        return hi === lo ? 0 : ((r - lo) / (hi - lo)) * 100
      })
      const k = sma(st, kn)
      const d = sma(k.map((x) => x ?? 0), dn)
      return l.map((_, i) => (i < rn + sn ? {} : { k: k[i], d: d[i] }))
    },
  })

  registerIndicator<Row>({
    name: 'VWAP', shortName: 'VWAP', calcParams: [], figures: [line('vwap')],
    calc: (l) => {
      const key = step(l) < DAY ? (t: number) => new Date(t).toISOString().slice(0, 10) : (t: number) => new Date(t).toISOString().slice(0, 4)
      let cur = ''
      let pv = 0
      let v = 0
      return l.map((k) => {
        const id = key(k.timestamp)
        if (id !== cur) [cur, pv, v] = [id, 0, 0]
        pv += ((k.high + k.low + k.close) / 3) * vol(k)
        v += vol(k)
        return v ? { vwap: pv / v } : {}
      })
    },
  })

  registerIndicator<Row>({
    name: 'SUPERTREND', shortName: 'SuperTrend', calcParams: [10, 3],
    figures: [{ key: 'up', title: 'AL: ', type: 'line' }, { key: 'down', title: 'SAT: ', type: 'line' }],
    styles: { lines: ['#26a69a', '#ef5350'].map((color) => ({ style: 'solid', smooth: false, size: 2, dashedValue: [2, 2], color })) } as never,
    calc: (l, ind) => {
      const [n, m] = ind.calcParams as number[]
      const atr = rma(trueRange(l), n)
      let ub = 0
      let lb = 0
      let trendUp = true
      return l.map((k, i) => {
        const a = atr[i]
        if (a === undefined) return {}
        const mid = (k.high + k.low) / 2
        const [bu, bl] = [mid + m * a, mid - m * a]
        const pc = l[i - 1]?.close ?? k.close
        ub = ub && pc <= ub ? Math.min(bu, ub) : bu
        lb = lb && pc >= lb ? Math.max(bl, lb) : bl
        if (trendUp && k.close < lb) trendUp = false
        else if (!trendUp && k.close > ub) trendUp = true
        return trendUp ? { up: lb } : { down: ub }
      })
    },
  })

  registerIndicator<Row>({
    name: 'ICHIMOKU', shortName: 'Ichimoku', calcParams: [9, 26, 52],
    figures: [line('tenkan', 'Tenkan: '), line('kijun', 'Kijun: '), line('spanA', 'Senkou A: '), line('spanB', 'Senkou B: '), line('chikou', 'Chikou: ')],
    // Senkou A ile B arasını bulut olarak boyar (A üstteyse yeşil, alttaysa kırmızı)
    draw: ({ ctx, indicator, visibleRange, xAxis, yAxis }) => {
      const r = indicator.result as Row[]
      ctx.save()
      ctx.globalAlpha = 0.14
      for (let n = Math.max(1, visibleRange.from); n < visibleRange.to; n++) {
        const [p, c] = [r[n - 1], r[n]]
        if (p?.spanA === undefined || p.spanB === undefined || c?.spanA === undefined || c.spanB === undefined) continue
        const [x1, x2] = [xAxis.convertToPixel(n - 1), xAxis.convertToPixel(n)]
        ctx.fillStyle = c.spanA >= c.spanB ? '#26a69a' : '#ef5350'
        ctx.beginPath()
        ctx.moveTo(x1, yAxis.convertToPixel(p.spanA))
        ctx.lineTo(x2, yAxis.convertToPixel(c.spanA))
        ctx.lineTo(x2, yAxis.convertToPixel(c.spanB))
        ctx.lineTo(x1, yAxis.convertToPixel(p.spanB))
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      return false
    },
    calc: (l, ind) => {
      const [a, b, c] = ind.calcParams as number[]
      const mid = (i: number, n: number) => (i + 1 < n ? undefined : (highest(l, i, n) + lowest(l, i, n)) / 2)
      return l.map((_, i) => {
        const j = i - b
        const [t, kj] = j >= 0 ? [mid(j, a), mid(j, b)] : [undefined, undefined]
        return {
          tenkan: mid(i, a), kijun: mid(i, b),
          spanA: t !== undefined && kj !== undefined ? (t + kj) / 2 : undefined,
          spanB: j >= 0 ? mid(j, c) : undefined,
          chikou: l[i + b]?.close,
        }
      })
    },
  })

  registerIndicator<Row>({
    name: 'DONCHIAN', shortName: 'Donchian', calcParams: [20], figures: [line('up', 'Üst: '), line('mid', 'Orta: '), line('dn', 'Alt: ')],
    calc: (l, ind) => {
      const n = ind.calcParams[0] as number
      return l.map((_, i) => {
        if (i + 1 < n) return {}
        const [up, dn] = [highest(l, i, n), lowest(l, i, n)]
        return { up, dn, mid: (up + dn) / 2 }
      })
    },
  })

  registerIndicator<Row>({
    name: 'KELTNER', shortName: 'Keltner', calcParams: [20, 2], figures: [line('up', 'Üst: '), line('mid', 'Orta: '), line('dn', 'Alt: ')],
    calc: (l, ind) => {
      const [n, m] = ind.calcParams as number[]
      const mid = ema(l.map((k) => k.close), n)
      const atr = rma(trueRange(l), n)
      return l.map((_, i) => (atr[i] === undefined ? {} : { mid: mid[i], up: mid[i] + m * (atr[i] as number), dn: mid[i] - m * (atr[i] as number) }))
    },
  })

  registerIndicator<Row>({
    name: 'HMA', shortName: 'HMA', calcParams: [21], figures: [line('hma')],
    calc: (l, ind) => {
      const n = ind.calcParams[0] as number
      const c = l.map((k) => k.close)
      const [half, full] = [wma(c, Math.floor(n / 2)), wma(c, n)]
      const h = wma(half.map((x, i) => (x === undefined || full[i] === undefined ? undefined : 2 * x - (full[i] as number))), Math.round(Math.sqrt(n)))
      return h.map((hma) => ({ hma }))
    },
  })

  registerIndicator<Row>({
    name: 'PIVOT', shortName: 'Pivot', calcParams: [0],
    figures: ['p', 'r1', 'r2', 'r3', 's1', 's2', 's3'].map((k) => ({ key: k, title: `${k.toUpperCase()}: `, type: 'circle' })),
    styles: { circles: ['#f0b90b', '#ef5350', '#ef5350', '#ef5350', '#26a69a', '#26a69a', '#26a69a'].map((c) => ({ style: 'fill', upColor: c, downColor: c, noChangeColor: c })) } as never,
    // Standart (floor) pivot: bir önceki dönemin yüksek/düşük/kapanışından
    calc: (l, ind) => {
      const key = periodKey(PIVOT_KEYS[ind.calcParams[0] as number] ?? step(l))
      let cur = ''
      let prev: [number, number, number] | undefined
      let acc: [number, number, number] | undefined
      return l.map((k) => {
        const id = key(k.timestamp)
        if (id !== cur) [cur, prev, acc] = [id, acc, undefined]
        acc = acc ? [Math.max(acc[0], k.high), Math.min(acc[1], k.low), k.close] : [k.high, k.low, k.close]
        if (!prev) return {}
        const [h, lo, c] = prev
        const p = (h + lo + c) / 3
        return { p, r1: 2 * p - lo, s1: 2 * p - h, r2: p + h - lo, s2: p - h + lo, r3: h + 2 * (p - lo), s3: lo - 2 * (h - p) }
      })
    },
  })

  registerIndicator<Row>({
    name: 'VPVR', shortName: 'Hacim Profili', calcParams: [24, 0], figures: [],
    calc: (l) => l.map(() => ({})),
    // Ekranda görünen mumların hacmini fiyat dilimlerine dağıtıp sağ kenardan yatay çubuklar çizer
    draw: ({ ctx, kLineDataList, indicator, visibleRange, bounding, yAxis }) => {
      const rows = Math.max(4, (indicator.calcParams[0] as number) || 24)
      const fixed = (indicator.calcParams[1] as number) || 0
      const list = fixed > 0 ? kLineDataList.slice(-fixed) : kLineDataList.slice(visibleRange.from, visibleRange.to)
      if (!list.length) return true
      const hi = Math.max(...list.map((k) => k.high))
      const lo = Math.min(...list.map((k) => k.low))
      const size = (hi - lo) / rows || 1
      const up = new Array<number>(rows).fill(0)
      const down = new Array<number>(rows).fill(0)
      for (const k of list) {
        const [a, b] = [Math.floor((k.low - lo) / size), Math.min(rows - 1, Math.floor((k.high - lo) / size))]
        const share = vol(k) / (b - a + 1)
        for (let r = Math.max(0, a); r <= b; r++) (k.close >= k.open ? up : down)[r] += share
      }
      const max = Math.max(...up.map((u, i) => u + down[i]), 1)
      const poc = up.findIndex((u, i) => u + down[i] === max)
      const width = bounding.width * 0.3
      ctx.save()
      for (let r = 0; r < rows; r++) {
        const [y1, y2] = [yAxis.convertToPixel(lo + (r + 1) * size), yAxis.convertToPixel(lo + r * size)]
        const [wu, wd] = [(up[r] / max) * width, (down[r] / max) * width]
        const h = Math.max(1, y2 - y1 - 1)
        ctx.globalAlpha = r === poc ? 0.75 : 0.4
        ctx.fillStyle = '#26a69a'
        ctx.fillRect(bounding.width - wu, y1, wu, h)
        ctx.fillStyle = '#ef5350'
        ctx.fillRect(bounding.width - wu - wd, y1, wd, h)
      }
      const py = yAxis.convertToPixel(lo + (poc + 0.5) * size)
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = '#f0b90b'
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(bounding.width, py)
      ctx.stroke()
      ctx.restore()
      return true
    },
  })
}
