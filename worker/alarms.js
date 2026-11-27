// Zamanlanmış alarm kontrolü. Semboller toplu çekilir; KV'ye yalnızca alarm tetiklenince yazılır.
import { applyStep, evalAlert, needsSeries, nextStep } from '../src/lib/alertEval.ts'

const SPARK = 'https://query1.finance.yahoo.com/v7/finance/spark'
// Binance, Cloudflare'in bazı bölgelerinden gelen istekleri reddeder (403/451). Sırayla denenir, çalışan kaynak hatırlanır.
// MEXC aynı API biçimini ve aynı USDT paritelerini sunar; yalnızca saatlik aralık adı ve değişim birimi farklıdır.
export const CRYPTO = [
  { base: 'https://data-api.binance.vision/api/v3', tf: (t) => t, pct: 1 },
  { base: 'https://api.binance.com/api/v3', tf: (t) => t, pct: 1 },
  { base: 'https://api.mexc.com/api/v3', tf: (t) => ({ '1h': '60m', '1w': '1W' })[t] ?? t, pct: 100 },
  { base: 'https://api.binance.us/api/v3', tf: (t) => t, pct: 1 },
]
let source = 0

const RANGE = { '5m': ['5m', '5d'], '15m': ['15m', '1mo'], '1h': ['60m', '3mo'], '1d': ['1d', '1y'] }
const MAX_USERS = 20
const MAX_FETCH = 40
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }

function due(a, d) {
  const quarter = d.getUTCMinutes() % 15 < 5
  const weekday = d.getUTCDay() % 6 !== 0
  const h = d.getUTCHours()
  if (a.src === 'binance') return quarter
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

async function crypto(budget, path) {
  for (let n = 0; n < CRYPTO.length && budget.n > 0; n++, budget.n--) {
    const i = (source + n) % CRYPTO.length
    const r = await fetch(`${CRYPTO[i].base}/${path(CRYPTO[i])}`, { headers: HEADERS }).catch(() => null)
    if (r?.ok) {
      source = i
      return [await r.json(), CRYPTO[i]]
    }
  }
  return []
}

async function klines(budget, symbol, tf) {
  const [rows] = await crypto(budget, (c) => `klines?symbol=${symbol}&interval=${c.tf(tf)}&limit=300`)
  return Array.isArray(rows) ? rows.map((k) => +k[4]) : undefined
}

async function dayChange(budget, symbol) {
  const [t, c] = await crypto(budget, () => `ticker/24hr?symbol=${symbol}`)
  return t ? +t.priceChangePercent * c.pct : undefined
}

/** Tanılama: Worker'dan her kripto kaynağının HTTP durumu. */
export async function diag() {
  const out = {}
  for (const c of CRYPTO) {
    const r = await fetch(`${c.base}/klines?symbol=BTCUSDT&interval=${c.tf('1h')}&limit=2`, { headers: HEADERS }).catch((e) => ({ status: String(e) }))
    out[c.base] = r.status
  }
  return out
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
  const { keys } = await env.KV.list({ prefix: 'a:', limit: MAX_USERS })
  const users = []
  for (const k of keys) {
    const doc = await env.KV.get(k.name, 'json')
    const list = (doc?.alerts ?? []).filter((a) => a.active && due(a, now))
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
  const changes = {}
  for (const a of all.filter((x) => x.src === 'binance')) {
    const id = `${a.symbol}|${a.tf}`
    if (!(id in series)) series[id] = await klines(budget, a.symbol, a.tf)
    const needChange = a.conds.some((c) => c.kind.startsWith('change'))
    if (needChange && !(a.symbol in changes)) changes[a.symbol] = await dayChange(budget, a.symbol)
  }

  for (const u of users) {
    let changed = false
    for (const a of u.list) {
      const closes = series[`${a.symbol}|${a.tf}`] ?? []
      const q = quotes[a.symbol]
      const ctx = a.src === 'binance' ? { closes, price: closes[closes.length - 1], change: changes[a.symbol] } : { closes, price: q?.price, change: q?.change }
      const at = Date.now()
      const step = nextStep(a, evalAlert(a, ctx), at)
      if (!step) continue
      Object.assign(a, applyStep(a, step, at))
      changed = true
      if (step === 'fire' && a.notify?.tg !== false) await telegram(u.doc.tg, `${a.label} (şu an ${ctx.price ?? '—'})`)
    }
    if (changed) await env.KV.put(u.key, JSON.stringify(u.doc), { expirationTtl: 60 * 86400 })
  }
}
