// Alarm koşulu değerlendirmesi: tarayıcı ve Cloudflare Worker ortak kullanır (bağımlılıksız, hafif).
export type CondKind =
  | 'price_above' | 'price_below' | 'rsi_above' | 'rsi_below' | 'change_above' | 'change_below'
  | 'ema_above' | 'ema_below' | 'cross_up' | 'cross_down' | 'touch'
export type AlertTf = '5m' | '15m' | '1h' | '1d'
export const ALERT_TFS: AlertTf[] = ['5m', '15m', '1h', '1d']

/** cross_*: value = hızlı periyot, slow = yavaş periyot. touch: value = çizgi fiyatı. */
export interface Cond { kind: CondKind; value: number; ma?: 'EMA' | 'SMA'; slow?: number }
export interface Alert {
  id: string
  symbol: string
  tf: AlertTf
  op: 'AND' | 'OR'
  conds: Cond[]
  active: boolean
  triggeredAt?: number
}
export interface Ctx { closes: number[]; price?: number; change?: number }

export const COND_LABEL: Record<CondKind, string> = {
  price_above: 'Fiyat >', price_below: 'Fiyat <', rsi_above: 'RSI(14) >', rsi_below: 'RSI(14) <',
  change_above: 'Günlük değişim % >', change_below: 'Günlük değişim % <', ema_above: 'Fiyat > EMA(n)', ema_below: 'Fiyat < EMA(n)',
  cross_up: 'Ortalama kesişimi ↑', cross_down: 'Ortalama kesişimi ↓', touch: 'Yatay çizgiye dokunma',
}

export const needsSeries = (c: Cond) => !/^(price|change)_/.test(c.kind)

export function condText(c: Cond): string {
  const ma = c.ma ?? 'EMA'
  if (c.kind.startsWith('cross')) return `${ma}(${c.value}) ${c.kind === 'cross_up' ? '↑' : '↓'} ${ma}(${c.slow})`
  if (c.kind === 'touch') return `Çizgiye dokunma @ ${c.value}`
  if (c.kind.startsWith('ema')) return `Fiyat ${c.kind === 'ema_above' ? '>' : '<'} EMA(${c.value})`
  return `${COND_LABEL[c.kind]} ${c.value}`
}
export const alertText = (a: Alert) => `${a.conds.map(condText).join(a.op === 'AND' ? ' VE ' : ' VEYA ')} (${a.tf})`

// Son 4n mum yeterli: daha eski verinin EMA'ya etkisi ihmal edilebilir, hesap hafif kalır.
function avg(v: number[], n: number, end: number, kind: 'EMA' | 'SMA'): number | undefined {
  if (end < n || n < 1) return undefined
  if (kind === 'SMA') {
    let s = 0
    for (let i = end - n; i < end; i++) s += v[i]
    return s / n
  }
  const k = 2 / (n + 1)
  const start = Math.max(0, end - n * 4)
  let e = v[start]
  for (let i = start + 1; i < end; i++) e = v[i] * k + e * (1 - k)
  return e
}

function rsi14(v: number[]): number | undefined {
  const p = 14
  const start = Math.max(1, v.length - p * 8)
  if (v.length - start < p) return undefined
  let gain = 0
  let loss = 0
  for (let i = start; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    const n = Math.min(i - start + 1, p)
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
}

/** true/false: koşul sonucu; undefined: veri yetersiz. */
export function evalCond(c: Cond, { closes, price, change }: Ctx): boolean | undefined {
  const n = closes.length
  const p = price ?? closes[n - 1]
  const cmp = (now: number | undefined, ref: number | undefined) =>
    now === undefined || ref === undefined ? undefined : c.kind.endsWith('above') ? now > ref : now < ref
  switch (c.kind) {
    case 'price_above': case 'price_below': return cmp(p, c.value)
    case 'change_above': case 'change_below': return cmp(change, c.value)
    case 'rsi_above': case 'rsi_below': return cmp(rsi14(closes), c.value)
    case 'ema_above': case 'ema_below': return cmp(p, avg(closes, c.value, n, 'EMA'))
    case 'touch': {
      if (p === undefined) return undefined
      const recent = [...closes.slice(-3), p]
      return Math.min(...recent) <= c.value && Math.max(...recent) >= c.value
    }
    default: {
      const ma = c.ma ?? 'EMA'
      const slow = c.slow ?? 0
      const [f0, s0, f1, s1] = [avg(closes, c.value, n - 1, ma), avg(closes, slow, n - 1, ma), avg(closes, c.value, n, ma), avg(closes, slow, n, ma)]
      if (f0 === undefined || s0 === undefined || f1 === undefined || s1 === undefined) return undefined
      return c.kind === 'cross_up' ? f0 <= s0 && f1 > s1 : f0 >= s0 && f1 < s1
    }
  }
}

export function evalAlert(a: Alert, ctx: Ctx): boolean {
  const r = a.conds.map((c) => evalCond(c, ctx) === true)
  return r.length > 0 && (a.op === 'AND' ? r.every(Boolean) : r.some(Boolean))
}
