import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useAlerts } from '../store/alerts'
import { useApp } from '../store/app'
import { alertText, applyStep, evalAlert, needsSeries, nextStep, type Alert } from '../lib/alertEval'
import { cloudGet, cloudPut, cloudReady } from '../lib/cloud'
import { fmt } from '../lib/candles'
import { beep, browserNotify, telegram } from '../lib/notify'
import { displayName, getSymbol } from '../data/symbols'

interface Remote { alerts: Alert[] }

const message = (a: Alert) => `🔔 King of Trade: ${displayName(a.symbol)} · ${a.message?.trim() || alertText(a)}`

function announce(a: Alert, viaTelegram: boolean) {
  const { settings, prices } = useApp.getState()
  const msg = `${message(a)} (şu an ${fmt(prices[a.symbol]?.price)})`
  if (a.notify?.app !== false && settings.sound !== false) beep()
  if (a.notify?.app !== false && settings.notify !== false) browserNotify('King of Trade Alarm', msg)
  if (viaTelegram && a.notify?.tg !== false) telegram(settings.tgToken, settings.tgChat, msg).catch(() => undefined)
}

async function evaluate() {
  const { alerts, update } = useAlerts.getState()
  const { prices } = useApp.getState()
  for (const a of alerts.filter((x) => x.active)) {
    const q = prices[a.symbol]
    const closes = a.conds.some(needsSeries)
      ? await MarketRouter.getCandles(a.symbol, a.tf).then((l) => l.map((c) => c.close)).catch(() => [])
      : []
    const now = Date.now()
    const step = nextStep(a, evalAlert(a, { closes, price: q?.price, change: q?.change }), now)
    if (!step) continue
    update(a.id, applyStep(a, step, now))
    if (step === 'fire') announce(a, true)
  }
}

let pushed = ''
const payload = () => {
  const { tgToken, tgChat } = useApp.getState().settings
  const alerts = useAlerts.getState().alerts.map((a) => ({ ...a, src: getSymbol(a.symbol).source, label: message(a) }))
  return JSON.stringify({ tg: { token: tgToken, chat: tgChat }, alerts })
}

async function push() {
  const body = payload()
  if (body === pushed || !cloudReady()) return
  try {
    await cloudPut('a', JSON.parse(body))
    pushed = body
    useAlerts.setState({ cloud: 'ok' })
  } catch {
    useAlerts.setState({ cloud: 'err' })
  }
}

/** Sunucudaki durumu yerel listeyle birleştirir: sunucuda tetiklenenler işaretlenir, başka cihazda eklenenler alınır. */
async function pull() {
  if (!cloudReady()) return
  const remote = await cloudGet<Remote>('a').catch(() => undefined)
  if (remote === undefined) return void useAlerts.setState({ cloud: 'err' })
  const { alerts, deleted } = useAlerts.getState()
  const server = new Map((remote?.alerts ?? []).map((a) => [a.id, a]))
  const fired: Alert[] = []
  const merged = alerts.map((a) => {
    const r = server.get(a.id)
    if (!r || (r.triggeredAt ?? 0) <= (a.triggeredAt ?? 0)) return a
    fired.push(a)
    return { ...a, active: r.active, armed: r.armed, triggeredAt: r.triggeredAt }
  })
  const known = new Set(alerts.map((a) => a.id))
  const added = [...server.values()].filter((r) => !known.has(r.id) && !deleted.includes(r.id))
    .map(({ src: _s, label: _l, ...rest }: Alert & { src?: string; label?: string }) => rest)
  if (fired.length || added.length) useAlerts.setState({ alerts: [...merged, ...added] })
  useAlerts.setState({ cloud: 'ok' })
  fired.forEach((a) => announce(a, false))
}

export function useAlertEngine() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(push, 4_000)
    }
    let unsub: (() => void)[] = []
    pull().finally(() => {
      evaluate()
      schedule()
      unsub = [useAlerts.subscribe(schedule), useApp.subscribe((s, p) => s.settings !== p.settings && schedule())]
    })
    const ids = [setInterval(evaluate, 15_000), setInterval(() => !document.hidden && pull(), 120_000)]
    return () => {
      ids.forEach(clearInterval)
      clearTimeout(timer)
      unsub.forEach((u) => u())
    }
  }, [])
}
