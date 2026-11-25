// BIST evreni ve Yahoo verisinin anlık görüntüsünü üretir (proxy olmadan çalışan web sürümü için).
//   node scripts/snapshot.mjs universe <dosya>   → hisse listesi + endeks üyelikleri (derleme öncesi)
//   node scripts/snapshot.mjs <klasör>           → fiyat, mum ve tarama verisi (derleme sonrası)
import { mkdir, writeFile } from 'node:fs/promises'
import { EMTIA, INDICES, SYNTHETIC } from '../src/data/markets.ts'

const TV = 'https://scanner.tradingview.com/turkey/scan'
const YAHOO = 'https://query1.finance.yahoo.com'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', 'Content-Type': 'application/json' }
export const STAT_COLS = [
  'close', 'change', 'volume', 'market_cap_basic', 'price_earnings_ttm', 'price_book_fq', 'dividends_yield_current', 'Perf.W', 'Perf.1M',
  'Perf.YTD', 'Perf.Y', 'RSI', 'relative_volume_10d_calc', 'earnings_per_share_basic_ttm', 'return_on_equity', 'net_income',
  'total_revenue', 'debt_to_equity', 'price_52_week_high', 'price_52_week_low',
]
const TIER1 = { '1d': '10y', '60m': '6mo', '5m': '5d', '1m': '1d' }
const TIER2 = { '1d': '5y', '60m': '3mo', '5m': '5d' }

const safe = (s) => s.replace(/[^A-Za-z0-9]/g, '_')
const num = (x) => (typeof x === 'number' && isFinite(x) ? +x.toPrecision(7) : null)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function request(url, init, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { ...init, headers: HEADERS, signal: AbortSignal.timeout(20_000) })
      if (r.ok) return await r.json()
      if (r.status === 404) return null
    } catch {
      /* yeniden dene */
    }
    await sleep(800 * (i + 1))
  }
  return null
}

const scan = (body) => request(TV, { method: 'POST', body: JSON.stringify({ range: [0, 1500], ...body }) })

async function pool(items, size, fn) {
  let i = 0
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

async function universe() {
  const j = await scan({
    filter: [{ left: 'type', operation: 'equal', right: 'stock' }],
    options: { lang: 'tr' },
    columns: ['name', 'description', 'sector', 'industry', ...STAT_COLS],
    sort: { sortBy: 'name', sortOrder: 'asc' },
  })
  const rows = (j?.data ?? []).filter((x) => x.s.startsWith('BIST:') && /^[A-Z0-9]{3,6}$/.test(x.d[0]))
  if (rows.length < 300) throw new Error(`BIST listesi alınamadı (${rows.length})`)
  const idx = {}
  await pool(INDICES.map(([c]) => c), 4, async (code) => {
    const r = await scan({ symbols: { symbolset: [`SYML:BIST;${code}`] }, columns: ['name'] })
    const list = (r?.data ?? []).map((x) => x.d[0]).sort()
    if (list.length) idx[code] = list
  })
  return { rows, idx }
}

async function chart(out, symbol, interval, range) {
  const j = await request(`${YAHOO}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`)
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
  await writeFile(`${out}/c/${safe(symbol)}_${interval}.json`, JSON.stringify({ t: Date.now(), m: [m.regularMarketPrice, m.fiftyTwoWeekHigh, m.fiftyTwoWeekLow, m.currency], k }))
  return true
}

async function spark(symbols) {
  const q = {}
  for (let i = 0; i < symbols.length; i += 20) {
    const j = await request(`${YAHOO}/v7/finance/spark?symbols=${symbols.slice(i, i + 20).map(encodeURIComponent).join(',')}&range=1d&interval=1d`)
    for (const r of j?.spark?.result ?? []) {
      const m = r.response?.[0]?.meta
      if (m?.regularMarketPrice == null) continue
      const prev = m.chartPreviousClose
      q[r.symbol] = [m.regularMarketPrice, num(m.regularMarketChangePercent ?? (prev ? (m.regularMarketPrice / prev - 1) * 100 : 0))]
    }
  }
  return q
}

const [mode, target] = process.argv[2] === 'universe' ? ['universe', process.argv[3]] : ['snapshot', process.argv[2] ?? 'dist/data']
const { rows, idx } = await universe()

if (mode === 'universe') {
  await writeFile(target, JSON.stringify({ idx, s: rows.map((x) => x.d.slice(0, 3)) }))
  console.log(`evren: ${rows.length} hisse, ${Object.keys(idx).length} endeks`)
} else {
  await mkdir(`${target}/c`, { recursive: true })
  await writeFile(`${target}/bist.json`, JSON.stringify({ t: Date.now(), cols: STAT_COLS, idx, s: Object.fromEntries(rows.map((x) => [x.d[0], x.d.slice(4).map(num)])) }))
  const others = [...new Set([...INDICES.map(([c]) => `${c}.IS`), ...EMTIA.map(([c]) => c), ...Object.values(SYNTHETIC).flatMap((d) => [d.a, d.b])])]
  const top = new Set(idx.XU100 ?? [])
  const jobs = [
    ...others.flatMap((s) => Object.entries(TIER1).map(([iv, range]) => [s, iv, range])),
    ...rows.flatMap((x) => Object.entries(top.has(x.d[0]) ? TIER1 : TIER2).map(([iv, range]) => [`${x.d[0]}.IS`, iv, range])),
  ]
  let ok = 0
  const failed = new Set()
  await pool(jobs, 8, async ([s, iv, range]) => {
    if (await chart(target, s, iv, range)) ok++
    else failed.add(s)
  })
  const q = await spark(others)
  for (const x of rows) if (x.d[4] != null) q[`${x.d[0]}.IS`] = [x.d[4], num(x.d[5]) ?? 0]
  await writeFile(`${target}/quotes.json`, JSON.stringify({ t: Date.now(), q }))
  console.log(`grafik ${ok}/${jobs.length}, fiyat ${Object.keys(q).length}, alınamayan sembol: ${failed.size} ${[...failed].slice(0, 15).join(' ')}`)
  if (ok < jobs.length / 2) process.exit(1)
}
