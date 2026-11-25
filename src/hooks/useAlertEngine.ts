import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { ALERT_LABEL, useAlerts } from '../store/alerts'
import { useApp } from '../store/app'
import { fmt, rsi } from '../lib/candles'
import { beep, browserNotify, telegram } from '../lib/notify'
import { displayName } from '../data/symbols'

async function evaluate() {
  const { alerts, trigger } = useAlerts.getState()
  const { prices, settings } = useApp.getState()
  for (const a of alerts.filter((x) => x.active)) {
    let v: number | undefined
    if (a.kind.startsWith('price')) v = prices[a.symbol]?.price
    else v = await MarketRouter.getCandles(a.symbol, a.tf).then((l) => rsi(l.map((c) => c.close))).catch(() => undefined)
    if (v === undefined || !(a.kind.endsWith('above') ? v > a.value : v < a.value)) continue
    trigger(a.id)
    const msg = `🔔 King of Trade: ${displayName(a.symbol)} ${ALERT_LABEL[a.kind]} ${a.value} (şu an ${fmt(v)})`
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
