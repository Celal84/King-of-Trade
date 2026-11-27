// Cloudflare Worker: Yahoo proxy (/?url=), KV belge deposu (/kv/a alarmlar, /kv/u senkron) ve zamanlanmış alarm kontrolü.
import { CRYPTO, diag, runAlarms } from './alarms.js'

const ALLOWED = /^https:\/\/(query1|query2)\.finance\.yahoo\.com\//
const CODE = /^[A-Z2-9]{20}$/
const MAX_BODY = 1_000_000
// Alarm belgeleri uygulama her açıldığında yenilenir; 60 gün hiç açılmayan cihazın alarmları silinir.
const ALARM_TTL = 60 * 86400
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': '*',
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
  await env.KV.put(key, body, kind === 'a' ? { expirationTtl: ALARM_TTL } : undefined)
  return json('{"ok":true}')
}

async function proxy(target) {
  if (!target || !ALLOWED.test(target)) return new Response('Invalid url', { status: 400, headers: CORS })
  const upstream = await fetch(target, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    cf: { cacheTtl: 30, cacheEverything: true },
  })
  const headers = new Headers(CORS)
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
  headers.set('Cache-Control', 'public, max-age=30')
  return new Response(upstream.body, { status: upstream.status, headers })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(request.url)
    if (url.pathname === '/crypto') return cryptoProxy(url.searchParams.get('path'))
    if (url.pathname === '/diag') return json(JSON.stringify(await diag()))
    const kv = url.pathname.match(/^\/kv\/([au])$/)
    return kv ? store(request, env, kv[1], url.searchParams.get('code')) : proxy(url.searchParams.get('url'))
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAlarms(env, new Date(event.scheduledTime)))
  },
}
