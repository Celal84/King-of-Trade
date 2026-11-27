// Zamanlanmış alarm kontrolü. Semboller toplu çekilir; KV'ye yalnızca alarm tetiklenince yazılır.
import { applyStep, evalAlert, needsSeries, nextStep } from '../src/lib/alertEval.ts'

const SPARK = 'https://query1.finance.yahoo.com/v7/finance/spark'
const RANGE = { '5m': ['5m', '5d'], '15m': ['15m', '1mo'], '1h': ['60m', '3mo'], '1d': ['1d', '1y'] }
// Bir çalışmada okunacak en fazla kullanıcı belgesi. Etkin alarmı olmayanlar liste meta verisinden elenir.
const MAX_USERS = 40
export const ALARM_TTL = 60 * 86400
/** Liste sorgusunda belgeyi okumadan elemek için: etkin alarm sayısı. */
export const alarmMeta = (doc) => ({ a: (doc?.alerts ?? []).filter((x) => x.active).length })
const MAX_FETCH = 40
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

function due(a, d) {
  const quarter = d.getUTCMinutes() % 15 < 5
  const weekday = d.getUTCDay() % 6 !== 0
  const h = d.getUTCHours()
  if (a.src !== 'yahoo') return false
  return a.symbol.endsWith('.IS') ? weekday && h >= 7 && (h < 15 || (h === 15 && d.getUTCMinutes() <= 20)) : weekday && quarter
}

const uniq = (list) => [...new Set(list)]

async function spark(budget, symbols, interval, range) {
  const out = {}
  for (let i = 0; i < symbols.length && budget.n > 0; i += 20, budget.n--) {
    const q = symbols.slice(i, i + 20).map(encodeURIComponent).join(',')
    const r = await fetch(`${SPARK}?symbols=${q}&range=${range}&interval=${interval}`, { headers: HEADERS }).catch(() => null)
    if (!r?.ok) continue
    const j = await r.json()
    for (const x of j.spark?.result ?? []) {
      const res = x.response?.[0]
      out[x.symbol] = {
        closes: (res?.indicators?.quote?.[0]?.close ?? []).filter((v) => v != null),
        price: res?.meta?.regularMarketPrice,
        change: res?.meta?.regularMarketChangePercent,
      }
    }
  }
  return out
}

/** Tanılama: alarm belgesi sayıları. */
export async function diag(env) {
  const { keys } = await env.KV.list({ prefix: 'a:', limit: 1000 })
  return { alarmDocs: keys.length, withActive: keys.filter((k) => k.metadata?.a > 0).length, legacy: keys.filter((k) => !k.metadata).length }
}

async function telegram(tg, text) {
  if (!tg?.token || !tg?.chat) return
  await fetch(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: tg.chat, text }),
  }).catch(() => null)
}

export async function runAlarms(env, now) {
  const { keys } = await env.KV.list({ prefix: 'a:', limit: 1000 })
  const users = []
  // Meta verisi olmayan (eski) belgeler bir kez okunur: boşsa silinir, doluysa meta verisiyle yeniden yazılır
  for (const k of keys.filter((x) => !x.metadata || x.metadata.a > 0).slice(0, MAX_USERS)) {
    const doc = await env.KV.get(k.name, 'json')
    if (!doc?.alerts?.length) {
      await env.KV.delete(k.name)
      continue
    }
    if (!k.metadata) await env.KV.put(k.name, JSON.stringify(doc), { expirationTtl: ALARM_TTL, metadata: alarmMeta(doc) })
    const list = doc.alerts.filter((a) => a.active && due(a, now))
    if (list.length) users.push({ key: k.name, doc, list })
  }
  const all = users.flatMap((u) => u.list)
  if (!all.length) return

  const budget = { n: MAX_FETCH }
  const yahoo = all.filter((a) => a.src === 'yahoo')
  const quotes = yahoo.length ? await spark(budget, uniq(yahoo.map((a) => a.symbol)), '1d', '1d') : {}
  const series = {}
  for (const tf of Object.keys(RANGE)) {
    const symbols = uniq(yahoo.filter((a) => a.tf === tf && a.conds.some(needsSeries)).map((a) => a.symbol))
    if (!symbols.length) continue
    const data = await spark(budget, symbols, ...RANGE[tf])
    for (const s of symbols) series[`${s}|${tf}`] = data[s]?.closes
  }
  for (const u of users) {
    let changed = false
    for (const a of u.list) {
      const closes = series[`${a.symbol}|${a.tf}`] ?? []
      const q = quotes[a.symbol]
      const ctx = { closes, price: q?.price, change: q?.change }
      const at = Date.now()
      const step = nextStep(a, evalAlert(a, ctx), at)
      if (!step) continue
      Object.assign(a, applyStep(a, step, at))
      changed = true
      if (step === 'fire' && a.notify?.tg !== false) await telegram(u.doc.tg, `${a.label} (şu an ${ctx.price ?? '—'})`)
    }
    if (changed) await env.KV.put(u.key, JSON.stringify(u.doc), { expirationTtl: ALARM_TTL, metadata: alarmMeta(u.doc) })
  }
}
