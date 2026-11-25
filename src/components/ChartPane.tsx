import { useEffect, useRef, useState } from 'react'
import { ActionType, CandleType, DomPosition, OverlayMode, TooltipShowRule, YAxisType, dispose, init, utils, type Chart, type OverlayCreate } from 'klinecharts'
import type { Candle, CandleKind, Timeframe } from '../types'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { useReplay } from '../store/replay'
import { heikinAshi, mergeCandle, fmt } from '../lib/candles'
import { COMPARE_COLORS, COMPARE_SLOTS, DARK, lineStyle, MAIN_PANE_INDICATORS, UP, DOWN, setupKline } from '../lib/klineSetup'
import { paneApis } from '../lib/chartRegistry'
import { loadDrawings, saveDrawings } from '../lib/drawings'
import { displayName, getSymbol } from '../data/symbols'

const GROUP = 'drawings'
const TEXT_TOOLS = ['kotText', 'simpleAnnotation', 'simpleTag']
const view = (l: Candle[]) => (useApp.getState().candleKind === 'heikin' ? heikinAshi(l) : l)
const precisionOf = (p = 1) => (p < 1 ? 6 : p < 10 ? 4 : 2)
const DEFAULT_BAR = 8

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
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [lastClose, setLastClose] = useState<number>()
  const symbol = useApp((s) => s.panes[index])
  const tf = useApp((s) => s.tf)
  const ccy = useApp((s) => s.ccy)
  const kind = useApp((s) => s.candleKind)
  const log = useApp((s) => s.logScale)
  const indicators = useApp((s) => s.indicators)
  const indicatorConfig = useApp((s) => s.indicatorConfig)
  const compare = useApp((s) => s.compare)
  const magnet = useApp((s) => s.magnet)
  const visible = useApp((s) => s.drawingsVisible)
  const isActive = useApp((s) => s.active === index)
  const quote = useApp((s) => s.prices[symbol])
  const snapshotAt = useApp((s) => s.snapshotAt)
  const shownCcy = MarketRouter.currencyOf(symbol, ccy)
  const converted = shownCcy !== getSymbol(symbol).currency
  symRef.current = converted ? `${symbol}:${shownCcy}` : symbol

  const save = () => {
    const c = chart.current
    if (!c || restoring.current) return
    const list = [...ids.current].flatMap((id) => {
      const o = c.getOverlayById(id)
      return o ? [{ name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp ?? 0, value: p.value ?? 0 })), extendData: o.extendData }] : []
    })
    saveDrawings(symRef.current, list)
  }

  const create = (o: Partial<OverlayCreate> & { name: string }) => {
    const { magnet: m, drawingsVisible: v } = useApp.getState()
    const id = chart.current?.createOverlay({
      ...o,
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
    loadDrawings(symRef.current).forEach((d) => create(d))
    restoring.current = false
  }

  useEffect(() => {
    setupKline()
    const c = init(el.current!, { styles: DARK, locale: 'tr-TR' })!
    if (window.matchMedia('(max-width: 767px)').matches) c.setStyles({ candle: { tooltip: { showRule: TooltipShowRule.FollowCross } } })
    chart.current = c
    c.subscribeAction(ActionType.OnCrosshairChange, (d) => {
      hover.current = (d as { dataIndex?: number }).dataIndex ?? null
    })
    const ro = new ResizeObserver(() => c.resize())
    ro.observe(el.current!)
    paneApis.set(index, {
      draw: (name) => {
        if (TEXT_TOOLS.includes(name)) {
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
        if (last) c.removeOverlay(last)
      },
      screenshot: () => {
        const a = document.createElement('a')
        a.href = c.getConvertPictureUrl(true, 'png', '#131722')
        a.download = `${displayName(symRef.current.replace(':', '_'))}_${useApp.getState().tf}.png`
        a.click()
      },
      indicatorInfo: (name) => {
        const pane = indis.current.get(name)
        const ind = pane ? (c.getIndicatorByPaneId(pane, name) as { calcParams: number[]; figures: { type?: string }[] } | null) : null
        return ind ? { params: ind.calcParams, lines: ind.figures.filter((f) => f.type === 'line').length } : null
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
        restore()
        autoPrice()
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
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
      unsub()
    }
  }, [symbol, tf, ccy, index])

  useEffect(() => {
    chart.current?.setStyles({ candle: CANDLE_STYLE[kind] })
    if (raw.current.length && !useReplay.getState().active) chart.current?.applyNewData(view(raw.current))
  }, [kind])

  useEffect(() => {
    chart.current?.setStyles({ yAxis: { type: compare.length ? YAxisType.Percentage : log ? YAxisType.Log : YAxisType.Normal } })
  }, [log, compare.length])

  const configOf = (name: string) => {
    const cfg = useApp.getState().indicatorConfig[name]
    return {
      ...(cfg?.params?.length ? { calcParams: cfg.params } : {}),
      ...(cfg?.colors?.length ? { styles: { lines: cfg.colors.map((color) => lineStyle(color)) } as never } : {}),
    }
  }

  const syncIndicators = () => {
    const c = chart.current
    if (!c) return
    const want = useApp.getState().indicators
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

  useEffect(syncIndicators, [indicators])

  useEffect(() => {
    indis.current.forEach((pane, name) => chart.current?.overrideIndicator({ name, ...configOf(name) }, pane))
  }, [indicatorConfig])

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
    chart.current?.overrideOverlay({ groupId: GROUP, visible, mode: magnet ? OverlayMode.WeakMagnet : OverlayMode.Normal })
  }, [visible, magnet])

  const onClick = () => {
    useApp.getState().setActive(index)
    const r = useReplay.getState()
    if (r.active && r.selecting && r.pane === index && hover.current !== null) r.set({ cursor: hover.current, selecting: false })
  }

  const info = getSymbol(symbol)
  const delayed = snapshotAt !== null && info.source !== 'binance'
  return (
    <div onClick={onClick} className={`relative flex flex-col min-h-0 min-w-0 bg-bg border ${isActive ? 'border-acc/60' : 'border-transparent'}`}>
      <div className="flex items-center gap-2 px-2 h-6 text-xs shrink-0">
        <span className="font-semibold text-txt">{displayName(symbol)}</span>
        <span className="text-mute truncate"><span className="hidden sm:inline">{info.name} · </span>{tf} · {shownCcy}</span>
        {compare.filter((s) => s !== symbol).map((s, i) => (
          <button key={s} className="whitespace-nowrap hover:line-through" style={{ color: COMPARE_COLORS[i] }} title="Karşılaştırmadan çıkar"
            onClick={(e) => (e.stopPropagation(), useApp.getState().toggleCompare(s))}>● {displayName(s)}</button>
        ))}
        {delayed && <span className="text-yellow-500 whitespace-nowrap" title="Proxy tanımlı değil: veriler periyodik anlık görüntüden gelir">⏱ gecikmeli · {new Date(snapshotAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>}
        {converted && lastClose !== undefined && <span className="ml-auto whitespace-nowrap tabular-nums">{fmt(lastClose, precisionOf(lastClose))} {shownCcy}</span>}
        {quote && !converted && (
          <span className={`ml-auto whitespace-nowrap ${quote.change >= 0 ? 'text-up' : 'text-down'}`} style={{ color: quote.change >= 0 ? UP : DOWN }}>
            {fmt(quote.price)} ({quote.change >= 0 ? '+' : ''}{fmt(quote.change, 2)}%)
          </span>
        )}
      </div>
      <div ref={el} className="flex-1 min-h-0" style={{ touchAction: 'none' }} />
      {status !== 'ok' && (
        <div className="absolute inset-0 top-6 flex items-center justify-center text-mute text-sm pointer-events-none">
          {status === 'loading' ? 'Yükleniyor…' : 'Veri alınamadı. Ayarlar’dan Proxy URL girmeyi deneyin.'}
        </div>
      )}
    </div>
  )
}
