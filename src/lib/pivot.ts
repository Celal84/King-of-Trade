import { registerIndicator, type KLineData } from 'klinecharts'

export const PIVOT_TYPES = ['Geleneksel', 'Fibonacci', 'Woodie', 'Klasik', 'DM', 'Camarilla']
export const PIVOT_TFS = ['Otomatik', 'Günlük', 'Haftalık', 'Aylık', 'Üç Aylık', 'Yıllık']
/** Seviye sırası: P, S1, R1, S2, R2, … S5, R5. */
export const PIVOT_LEVELS = ['P', 'S1', 'R1', 'S2', 'R2', 'S3', 'R3', 'S4', 'R4', 'S5', 'R5']
export const PIVOT_COLOR = '#ff9800'
export interface PivotLevel { color: string; on: boolean }
export interface PivotExtra { daily?: KLineData[]; levels?: PivotLevel[] }
// [tip, zaman aralığı, geriye dönük sayı, etiket, fiyat, etiket konumu (0 sol, 1 sağ), çizgi kalınlığı]
const DEFAULTS = [0, 0, 15, 1, 1, 0, 1]
/** Eski sürümün tek parametreli (yalnızca dönem) ayarını yeni düzene çevirir. */
export const pivotParams = (p: number[]): number[] => (p.length >= DEFAULTS.length ? p : [0, [0, 1, 2, 3, 5][p[0] ?? 0] ?? 0, ...DEFAULTS.slice(2)])

const DAY = 86_400_000
type Key = (t: number) => string
const iso = (t: number) => new Date(t).toISOString()
const KEYS: Key[] = [
  (t) => iso(t).slice(0, 10),
  (t) => String(Math.floor((t - 4 * DAY) / (7 * DAY))),
  (t) => iso(t).slice(0, 7),
  (t) => `${iso(t).slice(0, 4)}-${Math.floor(new Date(t).getUTCMonth() / 3)}`,
  (t) => iso(t).slice(0, 4),
]
const stepOf = (l: KLineData[]) => (l.length > 2 ? l[l.length - 1].timestamp - l[l.length - 2].timestamp : DAY)
// Otomatik: 15 dk ve altı günlük, gün içi haftalık, günlük aylık, haftalık ve üstü yıllık
const autoKey = (dt: number) => KEYS[dt <= 15 * 60_000 ? 0 : dt < DAY ? 1 : dt < 7 * DAY ? 2 : 4]

interface Bar { o: number; h: number; l: number; c: number }
type Levels = (number | undefined)[]

/** Önceki dönemin açılış/yüksek/düşük/kapanışından (Woodie'de cari açılıştan da) seviyeleri hesaplar. */
function levels(type: number, { o, h, l, c }: Bar, open: number): Levels {
  const r = h - l
  const p = (h + l + c) / 3
  switch (type) {
    case 1: return [p, p - 0.382 * r, p + 0.382 * r, p - 0.618 * r, p + 0.618 * r, p - r, p + r]
    case 2: {
      const w = (h + l + 2 * open) / 4
      const [s3, r3] = [l - 2 * (h - w), h + 2 * (w - l)]
      return [w, 2 * w - h, 2 * w - l, w - r, w + r, s3, r3, s3 - r, r3 + r]
    }
    case 3: return [p, 2 * p - h, 2 * p - l, p - r, p + r, p - 2 * r, p + 2 * r, p - 3 * r, p + 3 * r]
    case 4: {
      const x = o === c ? h + l + 2 * c : c > o ? 2 * h + l + c : 2 * l + h + c
      return [x / 4, x / 2 - h, x / 2 - l]
    }
    case 5: {
      const k = 1.1 * r
      const r5 = (h / l) * c
      return [p, c - k / 12, c + k / 12, c - k / 6, c + k / 6, c - k / 4, c + k / 4, c - k / 2, c + k / 2, c - (r5 - c), r5]
    }
    default: return [p, 2 * p - h, 2 * p - l, p - r, p + r, 2 * p - (2 * h - l), 2 * p + (h - 2 * l), 3 * p - (3 * h - l), 3 * p + (h - 3 * l), 4 * p - (4 * h - l), 4 * p + (h - 4 * l)]
  }
}

interface Row { g?: number; lv?: Levels }

export function registerPivot() {
  registerIndicator<Row>({
    name: 'PIVOT', shortName: 'Pivots', calcParams: DEFAULTS, figures: [],
    // Başlıkta parametre dizisi yerine "Pivots Camarilla Yıllık" biçiminde ad gösterilir
    createTooltipDataSource: ({ indicator }) => {
      const [type, tf] = pivotParams(indicator.calcParams as number[])
      return { name: `Pivots ${PIVOT_TYPES[type] ?? ''} ${PIVOT_TFS[tf] ?? ''}`, calcParamsText: ' ', values: [] } as never
    },
    calc: (list, ind) => {
      const [type, tf] = pivotParams(ind.calcParams as number[])
      const daily = (ind.extendData as PivotExtra | undefined)?.daily
      const dt = stepOf(list)
      const key = tf > 0 ? KEYS[tf - 1] : autoKey(dt)
      // Gün içi grafikte dönem değerleri, daha uzun geçmişi olan günlük mumlardan alınır
      const source = daily?.length && dt < DAY ? daily : list
      const periods = new Map<string, Bar & { n: number }>()
      for (const k of source) {
        const id = key(k.timestamp)
        const b = periods.get(id)
        if (b) [b.h, b.l, b.c] = [Math.max(b.h, k.high), Math.min(b.l, k.low), k.close]
        else periods.set(id, { n: periods.size, o: k.open, h: k.high, l: k.low, c: k.close })
      }
      const order = [...periods.values()]
      const cache = new Map<string, Row>()
      return list.map((k) => {
        const id = key(k.timestamp)
        let row = cache.get(id)
        if (!row) {
          const cur = periods.get(id)
          const prev = cur ? order[cur.n - 1] : order[order.length - 1]
          row = prev ? { g: cur?.n ?? order.length, lv: levels(type, prev, cur?.o ?? k.open) } : {}
          cache.set(id, row)
        }
        return row
      })
    },
    // Her dönem için yatay parçalar ve "R1 (82.15)" biçiminde etiketler çizer
    draw: ({ ctx, indicator, visibleRange, bounding, barSpace, xAxis, yAxis }) => {
      const rows = indicator.result as Row[]
      const [, , back, showLabel, showPrice, pos, width] = pivotParams(indicator.calcParams as number[])
      const set = (indicator.extendData as PivotExtra | undefined)?.levels
      const last = rows[rows.length - 1]?.g
      if (last === undefined) return true
      ctx.save()
      ctx.setLineDash([])
      ctx.font = '11px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = Math.max(1, width)
      let n = Math.max(0, visibleRange.from)
      while (n < visibleRange.to) {
        const row = rows[n]
        let end = n
        while (end + 1 < rows.length && rows[end + 1]?.g === row?.g) end++
        if (row?.lv && row.g !== undefined && row.g > last - Math.max(1, back)) {
          let start = n
          while (start > 0 && rows[start - 1]?.g === row.g) start--
          const x1 = Math.max(0, xAxis.convertToPixel(start) - barSpace.halfBar)
          const x2 = row.g === last ? bounding.width : Math.min(bounding.width, xAxis.convertToPixel(end) + barSpace.halfBar)
          row.lv.forEach((v, i) => {
            if (v === undefined || set?.[i]?.on === false) return
            const y = Math.round(yAxis.convertToPixel(v)) + 0.5
            ctx.strokeStyle = ctx.fillStyle = set?.[i]?.color ?? PIVOT_COLOR
            ctx.beginPath()
            ctx.moveTo(x1, y)
            ctx.lineTo(x2, y)
            ctx.stroke()
            const text = [showLabel ? PIVOT_LEVELS[i] : '', showPrice ? (showLabel ? `(${v.toFixed(2)})` : v.toFixed(2)) : ''].filter(Boolean).join(' ')
            if (!text) return
            const w = ctx.measureText(text).width
            // Kenarda yer yoksa etiket çizginin üstüne, içeri doğru yazılır
            if (pos === 0) {
              const outside = x1 > w + 10
              ctx.textAlign = outside ? 'right' : 'left'
              ctx.fillText(text, outside ? x1 - 6 : x1 + 4, outside ? y : y - 7)
            } else {
              const outside = bounding.width - x2 > w + 10
              ctx.textAlign = outside ? 'left' : 'right'
              ctx.fillText(text, outside ? x2 + 6 : x2 - 4, outside ? y : y - 7)
            }
          })
        }
        n = end + 1
      }
      ctx.restore()
      return true
    },
  })
}
