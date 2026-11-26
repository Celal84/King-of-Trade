import type { Candle } from '../types'
import type { PineValues } from '../store/pine'

// PineTS (LuxAlgo, AGPL-3.0) yalnızca Pine sekmesi kullanılınca yüklenir; hesaplama tarayıcıda yapılır.
const load = () => import('pinets')

export const PINE_PREFIX = 'PINE_'
export interface PineInput { name: string; type: string; defval: unknown; options?: unknown[]; minval?: number; maxval?: number; step?: number }
export interface PinePlot { title: string; color: string; kind: 'line' | 'bar'; width: number; values: Map<number, number> }
export interface PineResult { overlay: boolean; plots: PinePlot[]; inputs: PineInput[]; skipped: string[] }

interface RawPlot { title?: string; options?: { style?: string; color?: string | null; linewidth?: number }; data?: { time: number; value: unknown; options?: { color?: string | null } }[] }

const PALETTE = ['#2962ff', '#ff9800', '#9c27b0', '#26a69a', '#ef5350', '#01c5c4']
const BAR_STYLES = ['style_histogram', 'style_columns']

function toBars(candles: Candle[]) {
  const step = candles.length > 1 ? candles[candles.length - 1].timestamp - candles[candles.length - 2].timestamp : 60_000
  return candles.map((c, i) => ({
    open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume, openTime: c.timestamp,
    closeTime: (candles[i + 1]?.timestamp ?? c.timestamp + step) - 1,
  }))
}

export async function pineInputs(code: string): Promise<PineInput[]> {
  const { Indicator } = await load()
  return new Indicator(code).getInputsMeta().map((m) => ({ name: m.title ?? m.name, type: m.type, defval: m.defval, options: m.options, minval: m.minval, maxval: m.maxval, step: m.step }))
}

export async function runPine(code: string, candles: Candle[], inputs: PineValues, tf: string): Promise<PineResult> {
  const { PineTS, Indicator } = await load()
  const indicator = new Indicator(code, inputs)
  const ctx = await new PineTS(toBars(candles), 'KOT', tf).run(indicator)
  const plots: PinePlot[] = []
  const skipped: string[] = []
  Object.entries(ctx.plots as Record<string, RawPlot>).forEach(([key, p]) => {
    const style = p.options?.style
    const drawable = !style || style.startsWith('style_') || style === 'hline'
    const values = new Map<number, number>()
    if (drawable) for (const d of p.data ?? []) if (typeof d.value === 'number' && isFinite(d.value)) values.set(d.time, d.value)
    if (!drawable || !values.size) {
      if (!key.startsWith('__') && (p.data ?? []).some((d) => d.value)) skipped.push(style ?? key)
      return
    }
    const color = p.options?.color ?? p.data?.find((d) => d.options?.color)?.options?.color ?? PALETTE[plots.length % PALETTE.length]
    plots.push({ title: p.title || key, color, kind: BAR_STYLES.includes(style ?? '') ? 'bar' : 'line', width: p.options?.linewidth ?? 1, values })
  })
  return {
    overlay: !!ctx.indicator?.overlay, plots, skipped: [...new Set(skipped)],
    inputs: indicator.getInputsMeta().map((m) => ({ name: m.title ?? m.name, type: m.type, defval: m.defval, options: m.options, minval: m.minval, maxval: m.maxval, step: m.step })),
  }
}

/** Kısa, satır numaralı hata metni; desteklenmeyen fonksiyonun adını yazar. */
export function pineError(e: unknown, code: string): string {
  const msg = e instanceof Error ? e.message : String(e)
  const lineOf = (needle: string) => {
    const i = code.split('\n').findIndex((l) => l.includes(needle))
    return i >= 0 ? `Satır ${i + 1}: ` : ''
  }
  const missing = msg.match(/([\w.$]+) is not a function/) ?? msg.match(/([\w.$]+) is not defined/) ?? msg.match(/reading '(\w+)'/)
  if (missing) return `${lineOf(missing[1])}Desteklenmeyen veya tanımsız: ${missing[1]}`
  const at = msg.match(/^(.*?)\s+at (\d+):(\d+)\s*$/s)
  if (at) return `Satır ${at[2]}, sütun ${at[3]}: ${at[1].replace(/^Failed to transpile Pine Script version \d+:\s*/, '')}`
  return msg.slice(0, 200)
}
