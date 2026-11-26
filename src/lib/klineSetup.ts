import { registerIndicator, registerLocale, registerOverlay, type Coordinate, type DeepPartial, type OverlayTemplate, type Styles } from 'klinecharts'
import type { Candle } from '../types'
import { CUSTOM_MAIN, registerCustomIndicators } from './indicators'

export const UP = '#26a69a'
export const DOWN = '#ef5350'
const LINE = '#2a2e39'
const MUTE = '#787b86'
const TXT = '#d1d4dc'

export const MAIN_PANE_INDICATORS = ['MA', 'EMA', 'SMA', 'BOLL', 'SAR', 'BBI', 'AVP', ...CUSTOM_MAIN]

const axis = { axisLine: { color: LINE }, tickLine: { color: LINE }, tickText: { color: MUTE } }
const cross = { line: { color: '#758696' }, text: { backgroundColor: '#363a45', borderColor: '#363a45' } }

export const DARK: DeepPartial<Styles> = {
  grid: { horizontal: { color: '#1f2430' }, vertical: { color: '#1f2430' } },
  candle: {
    bar: { upColor: UP, downColor: DOWN, upBorderColor: UP, downBorderColor: DOWN, upWickColor: UP, downWickColor: DOWN },
    priceMark: { last: { upColor: UP, downColor: DOWN } },
    tooltip: { text: { color: TXT } },
  },
  indicator: { tooltip: { text: { color: TXT } } },
  xAxis: axis,
  yAxis: axis,
  separator: { color: LINE },
  crosshair: { horizontal: cross, vertical: cross },
}

export const lineStyle = (color: string, size = 1) => ({ style: 'solid', smooth: false, size, dashedValue: [2, 2], color })
export const COMPARE_SLOTS = ['CMP1', 'CMP2', 'CMP3', 'CMP4']
export const COMPARE_COLORS = ['#f0b90b', '#e040fb', '#00bcd4', '#ff7043']
/** Yeni çizimlere uygulanan stil (renk ve kalınlık). */
export const drawingStyles = (color: string, size: number) => {
  const area = { style: 'stroke_fill', color: `${color}26`, borderColor: color, borderSize: size }
  return { line: { color, size }, polygon: area, circle: area, rect: area }
}
const shape = { needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true }
const poly = (coordinates: Coordinate[]) => ({ type: 'polygon', attrs: { coordinates } })
const label = (x: number, y: number, text: string, bg: string, baseline = 'bottom') => ({
  type: 'text', ignoreEvent: true, attrs: { x, y, text, align: 'left', baseline },
  styles: { color: '#fff', size: 11, backgroundColor: bg, borderSize: 0, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
})

const SHAPES: OverlayTemplate[] = [
  {
    name: 'kotRect', totalStep: 3, ...shape,
    createPointFigures: ({ coordinates: [a, b] }) => (b ? poly([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]) : []),
  },
  {
    name: 'kotTriangle', totalStep: 4, ...shape,
    createPointFigures: ({ coordinates }) => (coordinates.length > 1 ? poly(coordinates) : []),
  },
  {
    name: 'kotCircle', totalStep: 3, ...shape,
    createPointFigures: ({ coordinates: [a, b] }) =>
      b ? { type: 'circle', attrs: { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) } } : [],
  },
  {
    name: 'kotArrow', totalStep: 3, ...shape,
    createPointFigures: ({ coordinates: [a, b] }) => {
      if (!b) return []
      const ang = Math.atan2(b.y - a.y, b.x - a.x)
      const head = [0.4, -0.4].map((d) => ({ x: b.x - 12 * Math.cos(ang + d), y: b.y - 12 * Math.sin(ang + d) }))
      return [
        { type: 'line', attrs: { coordinates: [a, b] } },
        { type: 'polygon', ignoreEvent: true, attrs: { coordinates: [b, ...head] } },
      ]
    },
  },
  {
    // 1: giriş, 2: hedef, 3: zarar durdur → hedef girişin üstündeyse alış, altındaysa satış pozisyonu
    name: 'kotPosition', totalStep: 4, ...shape,
    createPointFigures: ({ overlay, coordinates }) => {
      const [e, t, s] = coordinates
      if (!t) return []
      const [pe, pt, ps] = overlay.points.map((p) => p.value ?? 0)
      const x2 = Math.max(e.x + 140, t.x, s?.x ?? 0)
      const box = (y: number, color: string) => ({
        type: 'rect', attrs: { x: e.x, y: Math.min(e.y, y), width: x2 - e.x, height: Math.abs(y - e.y) }, styles: { style: 'fill', color },
      })
      const pct = (v: number) => `${(((v - pe) / pe) * 100).toFixed(2)}%`
      const figs = [box(t.y, 'rgba(38,166,154,0.25)'), label(e.x, t.y, `Hedef ${pct(pt)}`, UP, t.y < e.y ? 'bottom' : 'top')]
      if (!s) return figs
      const rr = Math.abs(pt - pe) / Math.abs(pe - ps || 1)
      return [...figs, box(s.y, 'rgba(239,83,80,0.25)'), label(e.x, s.y, `Stop ${pct(ps)} · R/R ${rr.toFixed(2)}`, DOWN, s.y > e.y ? 'top' : 'bottom')]
    },
  },
]

let done = false

export function setupKline() {
  if (done) return
  done = true
  registerLocale('tr-TR', { time: 'Zaman: ', open: 'A: ', high: 'Y: ', low: 'D: ', close: 'K: ', volume: 'Hacim: ', change: 'Değişim: ', turnover: 'Tutar: ' })

  registerIndicator<{ atr?: number }>({
    name: 'ATR',
    shortName: 'ATR',
    calcParams: [14],
    figures: [{ key: 'atr', title: 'ATR: ', type: 'line' }],
    calc: (list, ind) => {
      const n = ind.calcParams[0] as number
      let prev = 0
      let sum = 0
      return list.map((k, i) => {
        const pc = i ? list[i - 1].close : k.close
        const tr = Math.max(k.high - k.low, Math.abs(k.high - pc), Math.abs(k.low - pc))
        if (i < n) {
          sum += tr
          if (i < n - 1) return {}
          prev = sum / n
        } else prev = (prev * (n - 1) + tr) / n
        return { atr: prev }
      })
    },
  })

  SHAPES.forEach(registerOverlay)
  registerCustomIndicators()

  COMPARE_SLOTS.forEach((name, i) =>
    registerIndicator<{ v?: number }>({
      name,
      shortName: name,
      calcParams: [],
      figures: [{ key: 'v', title: '', type: 'line' }],
      styles: { lines: [lineStyle(COMPARE_COLORS[i], 2)] } as never,
      // Karşılaştırılan sembol, ilk ortak mumda ana sembolün fiyatına eşitlenerek çizilir
      calc: (list, ind) => {
        const other = ((ind.extendData as { list?: Candle[] } | undefined)?.list ?? [])
        let j = -1
        let ratio: number | undefined
        return list.map((k) => {
          while (j + 1 < other.length && other[j + 1].timestamp <= k.timestamp) j++
          if (j < 0) return {}
          ratio ??= k.close / other[j].close
          return { v: other[j].close * ratio }
        })
      },
    }),
  )

  registerOverlay({
    name: 'kotText',
    totalStep: 2,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates }) => ({
      type: 'text',
      attrs: { x: coordinates[0].x, y: coordinates[0].y, text: String(overlay.extendData ?? 'Metin'), baseline: 'bottom' },
      styles: { color: TXT, size: 14, backgroundColor: 'rgba(41,98,255,0.25)', borderSize: 0 },
    }),
  })

  registerOverlay({
    name: 'kotMeasure',
    totalStep: 3,
    needDefaultPointFigure: true,
    needDefaultXAxisFigure: true,
    needDefaultYAxisFigure: true,
    createPointFigures: ({ overlay, coordinates, precision }) => {
      if (coordinates.length < 2) return []
      const [a, b] = coordinates
      const [p1, p2] = overlay.points
      const v1 = p1.value ?? 0
      const diff = (p2.value ?? 0) - v1
      const pct = v1 ? (diff / v1) * 100 : 0
      const bars = (p2.dataIndex ?? 0) - (p1.dataIndex ?? 0)
      const up = diff >= 0
      return [
        {
          type: 'rect',
          attrs: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) },
          styles: { style: 'fill', color: up ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)' },
        },
        {
          type: 'text',
          ignoreEvent: true,
          attrs: { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 6, text: `${diff.toFixed(precision.price)} (${pct.toFixed(2)}%) · ${bars} bar`, align: 'center', baseline: 'bottom' },
          styles: { color: '#fff', size: 12, backgroundColor: up ? UP : DOWN, borderSize: 0, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2 },
        },
      ]
    },
  })
}
