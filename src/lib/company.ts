import { cached, getJson, workerUrl } from '../adapters/http'

export interface FinRow { code: string; label: string; values: (number | null)[] }
export interface Financials { periods: string[]; rows: FinRow[] }
export interface Disclosure { index: number; date: string; subject: string; summary: string; from: string }

interface RawFin { value?: { itemCode: string; itemDescTr: string; value1: string | null; value2: string | null; value3: string | null; value4: string | null }[] }
interface RawKap { disclosureIndex: number; publishDate: string; subject: string | null; summary: string | null; kapTitle: string | null }

const HOUR = 3600_000
const code = (symbol: string) => symbol.replace(/\.IS$/, '')
const num = (v: string | null) => (v === null || v === '' ? null : +v)

/** Bugünden geriye dört dönem: çeyreklik (3, 6, 9, 12) veya yıl sonları; `skip` kadar dönem atlanır. */
function periodsOf(annual: boolean, skip: number): string[] {
  const now = new Date()
  let [y, q] = [now.getFullYear(), Math.floor(now.getMonth() / 3) * 3]
  if (annual) return Array.from({ length: 4 }, (_, i) => `${y - 1 - skip - i}-12`)
  const out: string[] = []
  for (let i = 0; i < 4 + skip; i++) {
    if (q === 0) [y, q] = [y - 1, 12]
    if (i >= skip) out.push(`${y}-${q}`)
    q -= 3
  }
  return out
}

async function load(symbol: string, annual: boolean, group: string, skip: number): Promise<Financials> {
  const periods = periodsOf(annual, skip)
  const j = (await getJson(`${workerUrl()}/fin?code=${code(symbol)}&group=${group}&periods=${periods.join(',')}`, 20_000)) as RawFin
  return { periods, rows: (j.value ?? []).map((r) => ({ code: r.itemCode, label: r.itemDescTr, values: [r.value1, r.value2, r.value3, r.value4].map(num) })) }
}
const hasFirst = (f: Financials) => f.rows.some((r) => r.values[0] !== null)

/** Mali tablolar. Sanayi şirketi grubu boş dönerse banka grubu denenir; son dönem henüz açıklanmadıysa bir dönem geriye gidilir. */
export const getFinancials = (symbol: string, annual: boolean): Promise<Financials> =>
  cached(`fin:${symbol}:${annual}`, HOUR, async () => {
    for (const group of ['XI_29', 'UFRS_K']) {
      const first = await load(symbol, annual, group, 0)
      if (!first.rows.length) continue
      if (hasFirst(first)) return first
      const older = await load(symbol, annual, group, 1)
      return hasFirst(older) ? older : first
    }
    throw new Error('Mali tablo bulunamadı')
  })

export const getDisclosures = (symbol: string): Promise<Disclosure[]> =>
  cached(`kap:${symbol}`, 5 * 60_000, async () => {
    const j = (await getJson(`${workerUrl()}/kap?code=${code(symbol)}&days=180`, 20_000)) as RawKap[]
    return j.map((d) => ({ index: d.disclosureIndex, date: d.publishDate, subject: (d.subject ?? '').trim(), summary: (d.summary ?? '').trim(), from: d.kapTitle ?? '' }))
  })

export const disclosureUrl = (index: number) => `https://www.kap.org.tr/tr/Bildirim/${index}`
export const companyDataReady = () => !!workerUrl()
