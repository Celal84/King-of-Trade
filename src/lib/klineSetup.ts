import { registerIndicator, registerLocale, registerOverlay, type DeepPartial, type Styles } from 'klinecharts'

export const UP = '#26a69a'
export const DOWN = '#ef5350'
const LINE = '#2a2e39'
const MUTE = '#787b86'
const TXT = '#d1d4dc'

export const MAIN_PANE_INDICATORS = ['MA', 'EMA', 'SMA', 'BOLL', 'SAR', 'BBI', 'AVP']

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
