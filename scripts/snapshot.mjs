// Yahoo verisinin anlık görüntüsünü üretir (proxy olmadan çalışan web sürümü için yedek kaynak).
// Kullanım: node scripts/snapshot.mjs <çıktı klasörü>   (ortam: SNAPSHOT_URL = önceki yayının data/ adresi)
import { mkdir, writeFile } from 'node:fs/promises'
import { SYMBOLS, SYNTHETIC } from '../src/data/symbols.ts'

const OUT = process.argv[2] ?? 'dist/data'
const PREV = process.env.SNAPSHOT_URL
const BASE = 'https://query1.finance.yahoo.com'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }
const RANGES = { '1d': '3y', '60m': '3mo', '5m': '5d', '1m': '1d' }
const FUND_TYPES = ['trailingPeRatio', 'trailingPbRatio', 'trailingMarketCap']
const FUND_TTL = 12 * 3600_000

const safe = (s) => s.replace(/[^A-Za-z0-9]/g, '_')
const num = (x) => (x == null ? null : +x.toPrecision(8))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const yahoo = SYMBOLS.filter((s) => s.source === 'yahoo')
const symbols = [...new Set([...yahoo.map((s) => s.symbol), ...Object.values(SYNTHETIC).flatMap((d) => [d.a, d.b])])]

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15_000) })
      if (r.ok) return await r.json()
      if (r.status === 404) return null
    } catch {
      /* yeniden dene */
    }
    await sleep(700 * (i + 1))
  }
  return null
}

async function pool(items, size, fn) {
  let i = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

const save = (name, data) => writeFile(`${OUT}/${name}`, JSON.stringify(data))

async function chart(symbol, interval) {
  const j = await get(`${BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${RANGES[interval]}&includePrePost=false`)
  const r = j?.chart?.result?.[0]
  if (!r?.timestamp) return false
  const q = r.indicators.quote[0]
  const m = r.meta
  const k = []
  r.timestamp.forEach((t, i) => {
    const c = q.close[i] ?? (i === r.timestamp.length - 1 ? m.regularMarketPrice : null)
    if (q.open[i] == null || q.high[i] == null || q.low[i] == null || c == null) return
    k.push([t, num(q.open[i]), num(Math.max(q.high[i], c)), num(Math.min(q.low[i], c)), num(c), q.volume[i] ?? 0])
  })
  await save(`c/${safe(symbol)}_${interval}.json`, { t: Date.now(), m: [m.regularMarketPrice, m.fiftyTwoWeekHigh, m.fiftyTwoWeekLow, m.currency], k })
  return true
}

async function quotes() {
  const q = {}
  for (let i = 0; i < symbols.length; i += 20) {
    const j = await get(`${BASE}/v7/finance/spark?symbols=${symbols.slice(i, i + 20).map(encodeURIComponent).join(',')}&range=1d&interval=1d`)
    for (const r of j?.spark?.result ?? []) {
      const m = r.response?.[0]?.meta
      if (m?.regularMarketPrice == null) continue
      const prev = m.chartPreviousClose
      q[r.symbol] = [m.regularMarketPrice, num(m.regularMarketChangePercent ?? (prev ? (m.regularMarketPrice / prev - 1) * 100 : 0))]
    }
  }
  await save('quotes.json', { t: Date.now(), q })
  return Object.keys(q).length
}

async function fundamentals() {
  if (PREV) {
    const old = await fetch(`${PREV}fund.json`, { signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (old && Date.now() - old.t < FUND_TTL && Object.keys(old.f ?? {}).length) return save('fund.json', old).then(() => 'önceki yayından')
  }
  const now = Math.floor(Date.now() / 1000)
  const f = {}
  await pool(yahoo.filter((s) => s.category === 'BIST' && s.sector !== 'Endeks'), 4, async ({ symbol }) => {
    const j = await get(`${BASE}/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${FUND_TYPES.join(',')}&period1=${now - 86400 * 400}&period2=${now}`, 2)
    const last = (type) => j?.timeseries?.result?.find((x) => x.meta.type[0] === type)?.[type]?.filter(Boolean).at(-1)?.reportedValue?.raw ?? null
    if (j) f[symbol] = FUND_TYPES.map(last)
  })
  await save('fund.json', { t: Date.now(), f })
  return Object.keys(f).length
}

await mkdir(`${OUT}/c`, { recursive: true })
let ok = 0
const jobs = symbols.flatMap((s) => Object.keys(RANGES).map((iv) => [s, iv]))
await pool(jobs, 6, async ([s, iv]) => {
  if (await chart(s, iv)) ok++
  else console.warn(`alınamadı: ${s} ${iv}`)
})
const nq = await quotes()
const nf = await fundamentals()
console.log(`grafik ${ok}/${jobs.length}, fiyat ${nq}/${symbols.length}, temel: ${nf}`)
if (ok < jobs.length / 2 || nq < symbols.length / 2) process.exit(1)
