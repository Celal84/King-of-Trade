import { useEffect, useMemo, useRef, useState } from 'react'
import { ActionType, CandleType, DomPosition, OverlayMode, TooltipShowRule, YAxisType, dispose, init, registerIndicator, utils, type Chart, type OverlayCreate } from 'klinecharts'
import type { Candle, CandleKind, Timeframe } from '../types'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { useReplay } from '../store/replay'
import { heikinAshi, mergeCandle, fmt } from '../lib/candles'
import { COMPARE_COLORS, COMPARE_SLOTS, DARK, drawingStyles, lineStyle, MAIN_PANE_INDICATORS, setupKline } from '../lib/klineSetup'
import { paneApis } from '../lib/chartRegistry'
import { loadDrawings, saveDrawings, type SavedDrawing } from '../lib/drawings'
import { displayName, getSymbol } from '../data/symbols'
import { usePine } from '../store/pine'
import { MOBILE } from '../hooks/useIsMobile'
import { marketOpen } from '../lib/market'
import { positionsOf, usePortfolio } from '../store/portfolio'
import { LINE_PALETTE } from '../lib/indicators'
import { PINE_PREFIX, runPine, type PineResult } from '../lib/pine'

const GROUP = 'drawings'
const TEXT_TOOLS = ['kotText', 'simpleAnnotation', 'simpleTag']
const view = (l: Candle[]) => (useApp.getState().candleKind === 'heikin' ? heikinAshi(l) : l)
const precisionOf = (p = 1) => (p < 1 ? 6 : p < 10 ? 4 : 2)
const DEFAULT_BAR = 8

type PineRows = Map<number, Record<string, number>>

function pineRows(r: PineResult): PineRows {
  const rows: PineRows = new Map()
  r.plots.forEach((p, i) => p.values.forEach((v, t) => rows.set(t, { ...rows.get(t), [`p${i}`]: v })))
  return rows
}

interface YAxisInternal {
  getRange: () => { from: number; to: number; range: number }
  setRange: (r: Record<string, number>) => void
  convertToRealValue: (v: number) => number
  setAutoCalcTickFlag: (f: boolean) => void
}
interface ChartInternal {
  getDrawPaneById: (id: string) => { getAxisComponent: () => YAxisInternal } | null
  adjustPaneViewport: (...flags: boolean[]) => void
}

const CANDLE_STYLE: Record<CandleKind, object> = {
  candle: { type: CandleType.CandleSolid },
  heikin: { type: CandleType.CandleSolid },
  hollow: { type: CandleType.CandleUpStroke },
  line: { type: CandleType.Area, area: { lineColor: '#2962ff', lineSize: 2, backgroundColor: [{ offset: 0, color: 'rgba(0,0,0,0)' }, { offset: 1, color: 'rgba(0,0,0,0)' }] } },
  area: { type: CandleType.Area, area: { lineColor: '#2962ff', lineSize: 2, backgroundColor: [{ offset: 0, color: 'rgba(41,98,255,0.01)' }, { offset: 1, color: 'rgba(41,98,255,0.35)' }] } },
}

export default function ChartPane({ index }: { index: number }) {
  const el = useRef<HTMLDivElement>(null)
  const chart = useRef<Chart | null>(null)
  const raw = useRef<Candle[]>([])
  const ids = useRef(new Set<string>())
  const indis = useRef(new Map<string, string>())
  const hover = useRef<number | null>(null)
  const restoring = useRef(false)
  const symRef = useRef('')
  const pendingFit = useRef<number | null>(null)
  const hidden = useRef(new Set<string>())
  const pinePanes = useRef(new Map<string, string>())
  const redoStack = useRef<SavedDrawing[]>([])
  const prevConfig = useRef(useApp.getState().indicatorConfig)
  const pivotDaily = useRef<Candle[]>()
  const brushPath = useRef<{ x: number; y: number }[] | null>(null)
  const [brush, setBrush] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [lastClose, setLastClose] = useState<number>()
  const [failure, setFailure] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [axis, setAxis] = useState({ width: 0, height: 0 })
  const dragY = useRef<number | null>(null)
  const symbol = useApp((s) => s.panes[index])
  const tf = useApp((s) => s.tf)
  const ccy = useApp((s) => s.ccy)
  const kind = useApp((s) => s.candleKind)
  const log = useApp((s) => s.logScale)
  const percent = useApp((s) => s.percentScale)
  const look = useApp((s) => s.look)
  const indicators = useApp((s) => s.indicators)
  const indicatorConfig = useApp((s) => s.indicatorConfig)
  const compare = useApp((s) => s.compare)
  const magnet = useApp((s) => s.magnet)
  const visible = useApp((s) => s.drawingsVisible)
  const isActive = useApp((s) => s.active === index)
  const quote = useApp((s) => s.prices[symbol])
  const snapshotAt = useApp((s) => s.snapshotAt)
  const note = useApp((s) => s.notes[symbol])
  const pineScripts = usePine((s) => s.scripts)
  const pineDraft = usePine((s) => s.draft)
  const txs = usePortfolio((s) => s.txs)
  const position = useMemo(() => positionsOf(txs.filter((t) => t.symbol === symbol)).find((p) => p.qty > 0), [txs, symbol])
  const shownCcy = MarketRouter.currencyOf(symbol, ccy)
  const converted = shownCcy !== getSymbol(symbol).currency
  symRef.current = converted ? `${symbol}:${shownCcy}` : symbol

  const save = () => {
    const c = chart.current
    if (!c || restoring.current) return
    const list = [...ids.current].flatMap((id) => {
      const o = c.getOverlayById(id)
      return o ? [{ name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp ?? 0, value: p.value ?? 0 })), extendData: o.extendData, styles: o.styles }] : []
    })
    saveDrawings(symRef.current, list)
  }

  const create = (o: Partial<OverlayCreate> & { name: string }) => {
    const { magnet: m, drawingsVisible: v, drawColor, drawSize } = useApp.getState()
    const id = chart.current?.createOverlay({
      ...o,
      styles: o.styles ?? (drawingStyles(drawColor, drawSize) as never),
      groupId: GROUP,
      mode: m ? OverlayMode.WeakMagnet : OverlayMode.Normal,
      visible: v,
      onDrawEnd: () => (save(), false),
      onPressedMoveEnd: () => (save(), false),
      onRemoved: (e) => (ids.current.delete(e.overlay.id), save(), false),
    })
    if (typeof id === 'string') ids.current.add(id)
  }

  const internal = () => chart.current as unknown as ChartInternal | null
  const yAxis = () => internal()?.getDrawPaneById('candle_pane')?.getAxisComponent()
  const scalePrice = (f: number) => {
    const y = yAxis()
    if (!y) return
    const { from, to, range } = y.getRange()
    const d = (range * f - range) / 2
    const [realFrom, realTo] = [y.convertToRealValue(from - d), y.convertToRealValue(to + d)]
    y.setRange({ from: from - d, to: to + d, range: range * f, realFrom, realTo, realRange: realTo - realFrom })
    internal()?.adjustPaneViewport(false, true, true, true)
  }
  const autoPrice = () => {
    yAxis()?.setAutoCalcTickFlag(true)
    internal()?.adjustPaneViewport(false, true, true, true)
  }
  const measure = () => {
    const s = chart.current?.getSize('candle_pane', DomPosition.YAxis)
    if (s) setAxis((a) => (a.width === s.width && a.height === s.height ? a : { width: s.width, height: s.height }))
  }
  const applyFit = () => {
    const c = chart.current
    const ms = pendingFit.current
    if (!c || ms === null) return
    pendingFit.current = null
    const list = c.getDataList()
    const from = (list.at(-1)?.timestamp ?? 0) - ms
    const bars = Math.max(10, list.filter((k) => k.timestamp >= from).length)
    const width = c.getSize('candle_pane', DomPosition.Main)?.width ?? 600
    c.setBarSpace(Math.min(50, Math.max(1, (width - 60) / bars)))
    c.scrollToRealTime()
    autoPrice()
  }

  const restore = () => {
    const c = chart.current
    if (!c) return
    restoring.current = true
    ids.current.clear()
    c.removeOverlay({ groupId: GROUP })
    loadDrawings(symRef.current).forEach((d) => create(d as Partial<OverlayCreate> & { name: string }))
    restoring.current = false
  }

  useEffect(() => {
    setupKline()
    const c = init(el.current!, { styles: DARK, locale: 'tr-TR' })!
    chart.current = c
    c.subscribeAction(ActionType.OnCrosshairChange, (d) => {
      hover.current = (d as { dataIndex?: number }).dataIndex ?? null
    })
    c.subscribeAction(ActionType.OnTooltipIconClick, (d) => {
      const { indicatorName: name, iconId, paneId } = d as { indicatorName: string; iconId: string; paneId: string }
      const st = useApp.getState()
      const slot = COMPARE_SLOTS.indexOf(name)
      if (iconId === 'settings') return slot < 0 && st.set({ editIndicator: name })
      if (iconId === 'close' && name.startsWith(PINE_PREFIX)) {
        const pine = usePine.getState()
        const script = name.slice(PINE_PREFIX.length)
        return pine.draft?.name === script ? pine.setDraft(null) : pine.toggle(script)
      }
      if (iconId === 'visible') {
        hidden.current[hidden.current.has(name) ? 'delete' : 'add'](name)
        return c.overrideIndicator({ name, visible: !hidden.current.has(name) }, paneId)
      }
      if (slot >= 0) {
        const s = st.compare.filter((x) => x !== symRef.current.split(':')[0])[slot]
        if (s) st.toggleCompare(s)
      } else st.toggleIndicator(name)
    })
    const ro = new ResizeObserver(() => (c.resize(), measure()))
    ro.observe(el.current!)
    paneApis.set(index, {
      draw: (name, data) => {
        if (name === 'kotBrush') setBrush(true)
        else if (data) create({ name, extendData: data })
        else if (TEXT_TOOLS.includes(name)) {
          const text = window.prompt('Metin:')
          if (text) create({ name, extendData: text })
        } else create({ name })
      },
      clear: () => {
        ids.current.clear()
        c.removeOverlay({ groupId: GROUP })
        saveDrawings(symRef.current, [])
      },
      zoom: (f) => c.zoomAtCoordinate(f, { x: (c.getSize('candle_pane', DomPosition.Main)?.width ?? 0) / 2, y: 0 }, 150),
      scalePrice,
      autoPrice,
      toLatest: () => c.scrollToRealTime(200),
      reset: () => {
        c.setBarSpace(DEFAULT_BAR)
        c.scrollToRealTime()
        autoPrice()
      },
      undo: () => {
        const last = [...ids.current].at(-1)
        const o = last ? c.getOverlayById(last) : null
        if (!last || !o) return
        redoStack.current.push({ name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp ?? 0, value: p.value ?? 0 })), extendData: o.extendData, styles: o.styles })
        c.removeOverlay(last)
      },
      redo: () => {
        const d = redoStack.current.pop()
        if (!d) return
        create(d as Partial<OverlayCreate> & { name: string })
        save()
      },
      goTo: (timestamp) => c.scrollToTimestamp(timestamp, 200),
      screenshot: () => {
        const a = document.createElement('a')
        a.href = c.getConvertPictureUrl(true, 'png', '#131722')
        a.download = `${displayName(symRef.current.replace(':', '_'))}_${useApp.getState().tf}.png`
        a.click()
      },
      candles: () => raw.current,
      markers: (list) => {
        c.removeOverlay({ groupId: 'kot-bt' })
        list.slice(-300).forEach((m) => {
          const color = m.buy ? '#26a69a' : '#ef5350'
          c.createOverlay({
            name: 'simpleAnnotation', groupId: 'kot-bt', lock: true, extendData: m.buy ? 'AL' : 'SAT', points: [{ timestamp: m.timestamp, value: m.price }],
            styles: { line: { color }, polygon: { color }, text: { color: '#ffffff', backgroundColor: color } },
          })
        })
      },
      indicatorInfo: (name) => {
        const pane = indis.current.get(name)
        const ind = pane ? (c.getIndicatorByPaneId(pane, name) as { calcParams: number[]; figures: { type?: string; title?: string }[] } | null) : null
        const lines = ind?.figures.filter((f) => f.type === 'line') ?? []
        return ind ? { params: ind.calcParams, lines: lines.length, titles: lines.map((f, i) => f.title?.replace(/[:\s]+$/, '') || `Çizgi ${i + 1}`) } : null
      },
      fit: (ms: number, next: Timeframe) => {
        pendingFit.current = ms
        if (useApp.getState().tf === next) applyFit()
        else useApp.getState().set({ tf: next })
      },
    })
    const unsubReplay = useReplay.subscribe((s, p) => {
      if (s.pane !== index) return
      const v = view(raw.current)
      if (s.active && !p.active) useReplay.getState().set({ length: v.length })
      else if (!s.active && p.active) c.applyNewData(v)
      else if (s.active && s.cursor !== p.cursor && s.cursor >= 0) {
        if (s.cursor === p.cursor + 1 && p.cursor >= 0) c.updateData(v[s.cursor])
        else c.applyNewData(v.slice(0, s.cursor + 1))
      }
    })
    return () => {
      unsubReplay()
      ro.disconnect()
      paneApis.delete(index)
      dispose(c)
    }
  }, [index])

  useEffect(() => {
    const c = chart.current!
    let alive = true
    let unsub = () => {}
    setStatus('loading')
    const rp = useReplay.getState()
    if (rp.active && rp.pane === index) rp.set({ active: false, playing: false, selecting: false, cursor: -1 })
    const daily = tf === '1d' || tf === '1w'
    c.setCustomApi({ formatDate: (dtf, ts, format) => utils.formatDate(dtf, ts, daily ? format.replace(' HH:mm', '') : format) })
    MarketRouter.getCandles(symbol, tf, ccy)
      .then((list) => {
        if (!alive) return
        raw.current = list
        c.setPriceVolumePrecision(precisionOf(list.at(-1)?.close), 2)
        c.applyNewData(view(list))
        c.removeOverlay({ groupId: 'kot-bt' })
        restore()
        autoPrice()
        measure()
        applyFit()
        setStatus(list.length ? 'ok' : 'error')
        const last = list.at(-1)
        setLastClose(last?.close)
        const st0 = useApp.getState()
        if (last && !converted && !st0.prices[symbol]) st0.setPrices({ [symbol]: { price: last.close, change: 0 } })
        unsub = MarketRouter.subscribe(symbol, tf, (k) => {
          raw.current = mergeCandle(raw.current, k)
          setLastClose(k.close)
          const st = useApp.getState()
          if (!converted) st.setPrices({ [symbol]: { price: k.close, change: st.prices[symbol]?.change ?? 0 } })
          const r = useReplay.getState()
          if (r.active && r.pane === index) return
          c.updateData(view(raw.current).at(-1)!)
        }, ccy)
      })
      .catch((e: unknown) => {
        if (!alive) return
        // Önceki sembolün mumları ekranda kalmasın
        raw.current = []
        c.applyNewData([])
        setFailure(e instanceof Error ? e.message : String(e))
        setStatus('error')
      })
    return () => {
      alive = false
      unsub()
    }
  }, [symbol, tf, ccy, index, attempt])

  useEffect(() => {
    chart.current?.setStyles({ candle: CANDLE_STYLE[kind] })
    if (raw.current.length && !useReplay.getState().active) chart.current?.applyNewData(view(raw.current))
  }, [kind])

  useEffect(() => {
    chart.current?.setStyles({ yAxis: { type: compare.length || percent ? YAxisType.Percentage : log ? YAxisType.Log : YAxisType.Normal } })
  }, [log, percent, compare.length])

  useEffect(() => {
    const { up, down } = look
    const mobile = window.matchMedia(MOBILE).matches
    const tick = { tickText: { size: look.fontSize, color: look.axisText } }
    const line = (show: boolean) => ({ show, color: look.gridColor })
    chart.current?.setStyles({
      grid: { show: look.gridH || look.gridV, horizontal: line(look.gridH), vertical: line(look.gridV) },
      candle: {
        bar: { upColor: up, downColor: down, upBorderColor: up, downBorderColor: down, upWickColor: up, downWickColor: down },
        priceMark: { high: { show: look.highLow }, low: { show: look.highLow }, last: { show: look.priceLine, upColor: up, downColor: down } },
        tooltip: { showRule: !look.ohlc ? TooltipShowRule.None : mobile ? TooltipShowRule.FollowCross : TooltipShowRule.Always },
      },
      indicator: { tooltip: { showRule: look.indValues ? TooltipShowRule.Always : TooltipShowRule.None } },
      crosshair: { show: look.crosshair },
      xAxis: tick,
      yAxis: tick,
    })
    if (el.current) el.current.style.backgroundColor = look.bg
  }, [look])

  const configOf = (name: string) => {
    const cfg = useApp.getState().indicatorConfig[name]
    const lines = cfg?.colors?.map((color, i) =>
      cfg.hidden?.[i] ? lineStyle('transparent') : { ...lineStyle(color || LINE_PALETTE[i % LINE_PALETTE.length], cfg.sizes?.[i] ?? 1), style: cfg.dashed?.[i] ? 'dashed' : 'solid', dashedValue: [4, 4] })
    return {
      ...(name === 'PIVOT' ? { extendData: { daily: pivotDaily.current, levels: cfg?.extra } } : {}),
      ...(cfg?.params?.length ? { calcParams: cfg.params } : {}),
      ...(lines?.length ? { styles: { lines } as never } : {}),
    }
  }

  const syncIndicators = () => {
    const c = chart.current
    if (!c) return
    const st = useApp.getState()
    const want = st.indicators.filter((n) => st.indicatorConfig[n]?.tfs?.includes(st.tf) ?? true)
    indis.current.forEach((pane, name) => {
      if (!want.includes(name)) {
        c.removeIndicator(pane, name)
        indis.current.delete(name)
      }
    })
    want.forEach((name) => {
      if (indis.current.has(name)) return
      const main = MAIN_PANE_INDICATORS.includes(name)
      const pane = c.createIndicator({ name, ...configOf(name) }, main, main ? { id: 'candle_pane' } : { height: 90 })
      if (pane) indis.current.set(name, pane)
    })
  }

  useEffect(() => {
    syncIndicators()
    const id = setTimeout(measure, 100)
    return () => clearTimeout(id)
  }, [indicators])

  useEffect(() => {
    // Ayarı sıfırlanan indikatör yeniden oluşturulur; böylece varsayılan parametre ve renklerine döner
    const filled = (c?: object) => !!c && Object.values(c).some((v) => v !== undefined)
    indis.current.forEach((pane, name) => {
      if (!filled(prevConfig.current[name]) || filled(indicatorConfig[name])) return
      chart.current?.removeIndicator(pane, name)
      indis.current.delete(name)
    })
    prevConfig.current = indicatorConfig
    syncIndicators()
    indis.current.forEach((pane, name) => chart.current?.overrideIndicator({ name, ...configOf(name) }, pane))
  }, [indicatorConfig, tf])

  // Portföyde bu sembolden pozisyon varsa maliyet çizgisi gösterilir ve fiyat değiştikçe kâr/zarar güncellenir
  useEffect(() => {
    const c = chart.current
    const id = `kot-pos-${index}`
    const last = raw.current.at(-1)
    if (!c || status !== 'ok' || !position || converted || !last) return void c?.removeOverlay(id)
    const price = quote?.price ?? last.close
    const pnl = (price - position.avg) * position.qty
    const sign = pnl >= 0 ? '+' : ''
    const data = {
      points: [{ timestamp: last.timestamp, value: position.avg }],
      extendData: {
        color: pnl >= 0 ? look.up : look.down,
        text: `Maliyet ${fmt(position.avg)} · ${fmt(position.qty, position.qty % 1 ? 4 : 0)} adet · K/Z ${sign}${fmt(pnl, 2)} (${sign}${fmt((price / position.avg - 1) * 100, 2)}%)`,
      },
    }
    if (c.getOverlayById(id)) c.overrideOverlay({ id, ...data })
    else c.createOverlay({ id, name: 'kotCost', groupId: 'kot-pos', lock: true, ...data })
  }, [position, status, quote?.price, converted, look, index])

  // Gün içi grafikte pivot dönemleri (ör. yıllık) için daha uzun geçmişli günlük mumlar yüklenir
  useEffect(() => {
    pivotDaily.current = undefined
    if (!indicators.includes('PIVOT') || status !== 'ok' || ['1d', '1w', '1M'].includes(tf)) return
    let alive = true
    MarketRouter.getCandles(symbol, '1d', ccy).then((list) => {
      const pane = indis.current.get('PIVOT')
      if (!alive || !pane) return
      pivotDaily.current = list
      chart.current?.overrideIndicator({ name: 'PIVOT', ...configOf('PIVOT') }, pane)
    }).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [indicators, symbol, tf, ccy, status])

  useEffect(() => {
    const c = chart.current
    if (!c || status !== 'ok') return
    let alive = true
    COMPARE_SLOTS.forEach((n) => c.removeIndicator('candle_pane', n))
    compare.filter((s) => s !== symbol).forEach((s, i) => {
      MarketRouter.getCandles(s, tf, ccy)
        .then((list) => alive && c.createIndicator({ name: COMPARE_SLOTS[i], shortName: displayName(s), extendData: { list } }, true, { id: 'candle_pane' }))
        .catch(() => undefined)
    })
    return () => {
      alive = false
    }
  }, [compare, symbol, tf, ccy, status])

  useEffect(() => {
    const c = chart.current
    if (!c || status !== 'ok') return
    let alive = true
    const panes = pinePanes.current
    const shown = [...pineScripts.filter((s) => s.on && s.name !== pineDraft?.name), ...(pineDraft ? [pineDraft] : [])]
    const draw = () => shown.forEach((s) => {
      runPine(s.code, raw.current, s.inputs, tf).then((r) => {
        if (!alive || !r.plots.length) return
        const name = PINE_PREFIX + s.name
        const pane = panes.get(name)
        if (pane) return c.overrideIndicator({ name, extendData: pineRows(r) }, pane)
        registerIndicator({
          name, shortName: s.name, precision: 2,
          figures: r.plots.map((p, i) => ({ key: `p${i}`, title: `${p.title}: `, type: p.kind, ...(p.kind === 'bar' ? { baseValue: 0, styles: () => ({ color: p.color }) } : {}) })),
          calc: (list, ind) => list.map((k) => (ind.extendData as PineRows).get(k.timestamp) ?? {}),
        })
        const lines = r.plots.filter((p) => p.kind === 'line').map((p) => lineStyle(p.color, p.width))
        const created = c.createIndicator({ name, extendData: pineRows(r), styles: { lines } as never }, r.overlay, r.overlay ? { id: 'candle_pane' } : { height: 100 })
        if (created) panes.set(name, created)
      }).catch(() => undefined)
    })
    draw()
    const id = setInterval(draw, 60_000)
    return () => {
      alive = false
      clearInterval(id)
      panes.forEach((pane, name) => c.removeIndicator(pane, name))
      panes.clear()
    }
  }, [pineScripts, pineDraft, symbol, tf, ccy, status])

  useEffect(() => {
    chart.current?.overrideOverlay({ groupId: GROUP, visible, mode: magnet ? OverlayMode.WeakMagnet : OverlayMode.Normal })
  }, [visible, magnet])

  const onClick = () => {
    useApp.getState().setActive(index)
    const r = useReplay.getState()
    if (r.active && r.selecting && r.pane === index && hover.current !== null) r.set({ cursor: hover.current, selecting: false })
  }

  const brushEnd = () => {
    const c = chart.current
    const path = brushPath.current
    brushPath.current = null
    setBrush(false)
    if (!c || !path || path.length < 2) return
    const pts = c.convertFromPixel(path, { paneId: 'candle_pane' }) as { timestamp?: number; value?: number }[]
    const first = pts[0]
    if (first?.timestamp === undefined || first.value === undefined) return
    const bar = c.getBarSpace()
    create({ name: 'kotBrush', points: [{ timestamp: first.timestamp, value: first.value }], extendData: path.map((p, i) => [(p.x - path[0].x) / bar, pts[i].value ?? first.value]) })
    save()
  }
  const brushMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const path = brushPath.current
    if (!path) return
    const r = e.currentTarget.getBoundingClientRect()
    const p = { x: e.clientX - r.left, y: e.clientY - r.top }
    const g = e.currentTarget.getContext('2d')
    const last = path[path.length - 1]
    if (g && last) {
      g.strokeStyle = useApp.getState().drawColor
      g.lineWidth = useApp.getState().drawSize
      g.beginPath()
      g.moveTo(last.x, last.y)
      g.lineTo(p.x, p.y)
      g.stroke()
    }
    path.push(p)
  }
  const open = marketOpen(symbol)
  const info = getSymbol(symbol)
  const delayed = snapshotAt !== null && info.source !== 'binance'
  return (
    <div onClick={onClick} className={`relative flex flex-col min-h-0 min-w-0 bg-bg border ${isActive ? 'border-acc/60' : 'border-transparent'}`}>
      <div className="flex items-center gap-2 px-2 h-6 text-xs shrink-0">
        <span className="font-semibold text-txt">{displayName(symbol)}</span>
        {look.showStatus && <span className={`w-2 h-2 rounded-full shrink-0 ${open ? 'bg-up' : 'bg-mute'}`} title={open ? 'Piyasa açık' : 'Piyasa kapalı'} />}
        <span className="text-mute truncate">{look.showName && <span className="hidden sm:inline">{info.name} · </span>}{tf} · {shownCcy}</span>
        {compare.filter((s) => s !== symbol).map((s, i) => (
          <button key={s} className="whitespace-nowrap hover:line-through" style={{ color: COMPARE_COLORS[i] }} title="Karşılaştırmadan çıkar"
            onClick={(e) => (e.stopPropagation(), useApp.getState().toggleCompare(s))}>● {displayName(s)}</button>
        ))}
        {note && <span className="truncate text-yellow-300 max-w-[30%]" title={note}>📝 {note}</span>}
        {delayed && <span className="text-yellow-500 whitespace-nowrap" title="Proxy tanımlı değil: veriler periyodik anlık görüntüden gelir">⏱ gecikmeli · {new Date(snapshotAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>}
        {converted && lastClose !== undefined && <span className="ml-auto whitespace-nowrap tabular-nums">{fmt(lastClose, precisionOf(lastClose))} {shownCcy}</span>}
        {quote && !converted && (
          <span className={`ml-auto whitespace-nowrap ${quote.change >= 0 ? 'text-up' : 'text-down'}`} style={{ color: quote.change >= 0 ? look.up : look.down }}>
            {fmt(quote.price)}{look.showChange && ` ${quote.change >= 0 ? '+' : ''}${fmt(quote.price - quote.price / (1 + quote.change / 100))} (${quote.change >= 0 ? '+' : ''}${fmt(quote.change, 2)}%)`}
          </span>
        )}
      </div>
      <div className="relative flex-1 min-h-0">
        <div ref={el} className="absolute inset-0" style={{ touchAction: 'none' }} />
        {brush && (
          <canvas
            className="absolute inset-0 z-20 w-full h-full cursor-crosshair" style={{ touchAction: 'none' }}
            ref={(cv) => cv && cv.width !== cv.clientWidth && ((cv.width = cv.clientWidth), (cv.height = cv.clientHeight))}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              const r = e.currentTarget.getBoundingClientRect()
              brushPath.current = [{ x: e.clientX - r.left, y: e.clientY - r.top }]
            }}
            onPointerMove={brushMove} onPointerUp={brushEnd} onPointerCancel={brushEnd}
          />
        )}
        <div
          className="absolute right-0 top-0 z-10 cursor-ns-resize" style={{ ...axis, touchAction: 'none' }} title="Sürükle: fiyat ölçeği · çift dokun: otomatik"
          onPointerDown={(e) => (e.currentTarget.setPointerCapture(e.pointerId), (dragY.current = e.clientY))}
          onPointerMove={(e) => {
            if (dragY.current === null) return
            scalePrice(Math.exp((e.clientY - dragY.current) * 0.006))
            dragY.current = e.clientY
          }}
          onPointerUp={() => (dragY.current = null)}
          onPointerCancel={() => (dragY.current = null)}
          onWheel={(e) => scalePrice(Math.exp(e.deltaY * 0.001))}
          onDoubleClick={autoPrice}
        />
      </div>
      {status === 'loading' && <div className="absolute inset-0 top-6 flex items-center justify-center text-mute text-sm pointer-events-none">Yükleniyor…</div>}
      {status === 'error' && (
        <div className="absolute inset-0 top-6 z-20 flex flex-col items-center justify-center gap-2 text-sm text-center px-4">
          <span className="text-mute">Veri alınamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.</span>
          <button className="btn border border-line" onClick={(e) => (e.stopPropagation(), setAttempt((n) => n + 1))}>Yeniden dene</button>
          {failure && <span className="text-[10px] text-mute">Ayrıntı: {failure.slice(0, 80)}</span>}
        </div>
      )}
    </div>
  )
}
