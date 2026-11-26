import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { ALERT_LABEL, useAlerts, type Alert } from '../store/alerts'
import { useApp } from '../store/app'
import { fmt, rsi } from '../lib/candles'
import { beep, browserNotify, telegram } from '../lib/notify'
import { displayName } from '../data/symbols'

const emaLast = (v: number[], n: number) => {
  const k = 2 / (n + 1)
  return v.reduce((p, x, i) => (i ? x * k + p * (1 - k) : x), 0)
}

/** Alarmın izlediği güncel değer ve eşik; veri yoksa undefined. */
async function measure(a: Alert): Promise<[number, number] | undefined> {
  const { prices } = useApp.getState()
  const [type] = a.kind.split('_')
  if (type === 'price') return prices[a.symbol] && [prices[a.symbol].price, a.value]
  if (type === 'change') return prices[a.symbol] && [prices[a.symbol].change, a.value]
  const closes = await MarketRouter.getCandles(a.symbol, a.tf).then((l) => l.map((c) => c.close)).catch(() => undefined)
  if (!closes?.length) return undefined
  if (type === 'rsi') {
    const r = rsi(closes)
    return r === undefined ? undefined : [r, a.value]
  }
  return closes.length > a.value ? [closes[closes.length - 1], emaLast(closes, a.value)] : undefined
}

async function evaluate() {
  const { alerts, trigger } = useAlerts.getState()
  const { settings } = useApp.getState()
  for (const a of alerts.filter((x) => x.active)) {
    const m = await measure(a)
    if (!m || !(a.kind.endsWith('above') ? m[0] > m[1] : m[0] < m[1])) continue
    trigger(a.id)
    const msg = `🔔 King of Trade: ${displayName(a.symbol)} ${ALERT_LABEL[a.kind]} ${a.value} (şu an ${fmt(m[0])})`
    beep()
    browserNotify('King of Trade Alarm', msg)
    telegram(settings.tgToken, settings.tgChat, msg).catch(() => undefined)
  }
}

export function useAlertEngine() {
  useEffect(() => {
    evaluate()
    const id = setInterval(evaluate, 15_000)
    return () => clearInterval(id)
  }, [])
}
