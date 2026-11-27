// Cloudflare Worker: Yahoo proxy (/?url=), KV belge deposu (/kv/a alarmlar, /kv/u senkron) ve zamanlanmış alarm kontrolü.
import { ALARM_TTL, CRYPTO, alarmMeta, diag, runAlarms } from './alarms.js'

const ALLOWED = /^https:\/\/(query1|query2)\.finance\.yahoo\.com\//
const CODE = /^[A-Z2-9]{20}$/
const MAX_BODY = 1_000_000
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}
const UA = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36', Accept: 'application/json' }
const STOCK = /^[A-Z0-9]{3,6}$/
const IS_YATIRIM = 'https://www.isyatirim.com.tr/_layouts/15/IsYatirim.Website/Common/Data.aspx/MaliTablo'
const KAP = 'https://www.kap.org.tr/tr/api'
const pass = (r, maxAge) => new Response(r.body, { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${maxAge}` } })

// Mali tablolar (İş Yatırım): /fin?code=THYAO&group=XI_29&periods=2026-9,2026-6,2026-3,2025-12
async function financials(q) {
  const code = q.get('code') ?? ''
  const periods = (q.get('periods') ?? '').split(',').filter((p) => /^\d{4}-(3|6|9|12)$/.test(p)).slice(0, 4)
  const group = q.get('group') === 'UFRS_K' ? 'UFRS_K' : 'XI_29'
  if (!STOCK.test(code) || !periods.length) return new Response('Invalid query', { status: 400, headers: CORS })
  const args = periods.map((p, i) => `year${i + 1}=${p.split('-')[0]}&period${i + 1}=${p.split('-')[1]}`).join('&')
  const r = await fetch(`${IS_YATIRIM}?companyCode=${code}&exchange=TRY&financialGroup=${group}&${args}`, { headers: UA, cf: { cacheTtl: 3600, cacheEverything: true } })
  return pass(r, 3600)
}

// KAP bildirimleri: /kap?code=THYAO&days=180 — önce şirketin üye kimliği bulunur, sonra bildirimleri sorgulanır
async function disclosures(q) {
  const code = q.get('code') ?? ''
  if (!STOCK.test(code)) return new Response('Invalid query', { status: 400, headers: CORS })
  const members = await fetch(`${KAP}/member/filter/${code}`, { headers: UA, cf: { cacheTtl: 86400, cacheEverything: true } }).then((r) => (r.ok ? r.json() : [])).catch(() => [])
  const oid = members[0]?.mkkMemberOid
  if (!oid) return json('[]')
  const day = (t) => new Date(t).toISOString().slice(0, 10)
  const days = Math.min(365, Math.max(7, +(q.get('days') ?? 180) || 180))
  const r = await fetch(`${KAP}/disclosure/members/byCriteria`, {
    method: 'POST',
    headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromDate: day(Date.now() - days * 86400_000), toDate: day(Date.now()), mkkMemberOidList: [oid], subjectList: [] }),
  })
  return pass(r, 300)
}

let cryptoSource = 0

// Binance'e doğrudan ulaşamayan istemciler için: /crypto?path=/klines?... — sırayla Binance ve MEXC denenir.
// x-kot-pct: değişim yüzdesi alanının çarpanı (MEXC oran döndürür).
async function cryptoProxy(path) {
  if (!/^\/(klines\?|ticker\/24hr(\?|$))/.test(path ?? '')) return new Response('Invalid path', { status: 400, headers: CORS })
  for (let n = 0; n < CRYPTO.length; n++) {
    const i = (cryptoSource + n) % CRYPTO.length
    const c = CRYPTO[i]
    const url = c.base + path.replace(/interval=([^&]+)/, (_, t) => `interval=${c.tf(t)}`)
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }).catch(() => null)
    if (!r?.ok) continue
    cryptoSource = i
    return new Response(r.body, { headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=5', 'Access-Control-Expose-Headers': 'x-kot-pct', 'x-kot-pct': String(c.pct) } })
  }
  return new Response('Upstream error', { status: 502, headers: CORS })
}

const json = (body, status = 200) => new Response(body, { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

async function store(request, env, kind, code) {
  if (!CODE.test(code ?? '')) return json('{"error":"kod"}', 400)
  const key = `${kind}:${code}`
  if (request.method === 'GET') return json((await env.KV.get(key)) ?? 'null')
  if (request.method !== 'PUT') return json('{"error":"yöntem"}', 405)
  const body = await request.text()
  if (body.length > MAX_BODY) return json('{"error":"boyut"}', 413)
  if (kind !== 'a') await env.KV.put(key, body)
  else {
    // Alarm belgesi: alarm yoksa kayıt tutulmaz; varsa etkin alarm sayısı meta veriye yazılır (cron belgeyi okumadan eler).
    // Belge uygulama her açıldığında yenilenir; 60 gün hiç açılmayan cihazın alarmları silinir.
    let doc = null
    try {
      doc = JSON.parse(body)
    } catch {
      return json('{"error":"biçim"}', 400)
    }
    if (!doc?.alerts?.length) await env.KV.delete(key)
    else await env.KV.put(key, body, { expirationTtl: ALARM_TTL, metadata: alarmMeta(doc) })
  }
  return json('{"ok":true}')
}

async function proxy(target) {
  if (!target || !ALLOWED.test(target)) return new Response('Invalid url', { status: 400, headers: CORS })
  const upstream = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    cf: { cacheTtl: 5, cacheEverything: true },
  })
  const headers = new Headers(CORS)
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
  headers.set('Cache-Control', 'public, max-age=5')
  return new Response(upstream.body, { status: upstream.status, headers })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)
    if (url.pathname === '/fin') return financials(url.searchParams)
    if (url.pathname === '/kap') return disclosures(url.searchParams)
    if (url.pathname === '/crypto') return cryptoProxy(url.searchParams.get('path'))
    if (url.pathname === '/diag') return json(JSON.stringify(await diag(env)))
    const kv = url.pathname.match(/^\/kv\/([au])$/)
    return kv ? store(request, env, kv[1], url.searchParams.get('code')) : proxy(url.searchParams.get('url'))
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAlarms(env, new Date(event.scheduledTime)))
  },
}
