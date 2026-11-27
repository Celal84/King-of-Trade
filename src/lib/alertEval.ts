// Alarm koşulu değerlendirmesi: tarayıcı ve Cloudflare Worker ortak kullanır (bağımlılıksız, hafif).
export type CondKind =
  | 'price_above' | 'price_below' | 'price_up' | 'price_down' | 'touch'
  | 'ema_above' | 'ema_below' | 'ema_up' | 'ema_down'
  | 'rsi_above' | 'rsi_below' | 'rsi_up' | 'rsi_down'
  | 'change_above' | 'change_below' | 'cross_up' | 'cross_down'
export type AlertTf = '5m' | '15m' | '1h' | '1d'
export const ALERT_TFS: AlertTf[] = ['5m', '15m', '1h', '1d']

/** cross_*: value = hızlı periyot, slow = yavaş periyot. ema_*: value = EMA periyodu. Diğerleri: value = eşik. */
export interface Cond { kind: CondKind; value: number; ma?: 'EMA' | 'SMA'; slow?: number }
export interface Alert {
  id: string
  symbol: string
  tf: AlertTf
  op: 'AND' | 'OR'
  conds: Cond[]
  active: boolean
  triggeredAt?: number
  /** Her seferinde tetiklen: koşul bir kez yanlış olmadan yeniden tetiklenmez (armed). */
  repeat?: boolean
  armed?: boolean
  /** Son kullanma zamanı (ms); geçince alarm kapanır. */
  expires?: number
  message?: string
  notify?: { app?: boolean; tg?: boolean }
}
export interface Ctx { closes: number[]; price?: number; change?: number }

// Alarm penceresindeki üç seçim (kaynak, işlem, karşı taraf) ile koşul türü arasındaki eşleme
export type Src = 'price' | 'rsi' | 'change' | 'ma'
export type Op = 'cross' | 'up' | 'down' | 'gt' | 'lt'
export type Rhs = 'value' | 'ema'
const SHAPES: [CondKind, Src, Op, Rhs][] = [
  ['touch', 'price', 'cross', 'value'], ['price_up', 'price', 'up', 'value'], ['price_down', 'price', 'down', 'value'], ['price_above', 'price', 'gt', 'value'], ['price_below', 'price', 'lt', 'value'],
  ['ema_up', 'price', 'up', 'ema'], ['ema_down', 'price', 'down', 'ema'], ['ema_above', 'price', 'gt', 'ema'], ['ema_below', 'price', 'lt', 'ema'],
  ['rsi_up', 'rsi', 'up', 'value'], ['rsi_down', 'rsi', 'down', 'value'], ['rsi_above', 'rsi', 'gt', 'value'], ['rsi_below', 'rsi', 'lt', 'value'],
  ['change_above', 'change', 'gt', 'value'], ['change_below', 'change', 'lt', 'value'],
  ['cross_up', 'ma', 'up', 'value'], ['cross_down', 'ma', 'down', 'value'],
]
export const SRC_LABEL: Record<Src, string> = { price: 'Fiyat', rsi: 'RSI(14)', change: 'Günlük değişim %', ma: 'Ortalama kesişimi' }
export const OP_LABEL: Record<Op, string> = { cross: 'Kesişme', up: 'Yukarı kesişme', down: 'Aşağı kesişme', gt: 'Büyüktür', lt: 'Küçüktür' }
export const shapeOf = (kind: CondKind) => {
  const [, src, op, rhs] = SHAPES.find((x) => x[0] === kind) ?? SHAPES[0]
  return { src, op, rhs }
}
export const opsFor = (src: Src, rhs: Rhs): Op[] => SHAPES.filter((x) => x[1] === src && x[3] === rhs).map((x) => x[2])
/** Seçime uyan koşul türü; işlem bu kaynakta yoksa kaynağın ilk geçerli işlemi kullanılır. */
export const kindOf = (src: Src, op: Op, rhs: Rhs): CondKind =>
  (SHAPES.find((x) => x[1] === src && x[2] === op && x[3] === rhs) ?? SHAPES.find((x) => x[1] === src && x[3] === rhs) ?? SHAPES.find((x) => x[1] === src) ?? SHAPES[0])[0]

export const needsSeries = (c: Cond) => !/^(price_above|price_below|change_)/.test(c.kind)

export function condText(c: Cond): string {
  const { src, op, rhs } = shapeOf(c.kind)
  const ma = c.ma ?? 'EMA'
  if (src === 'ma') return `${ma}(${c.value}) ${op === 'up' ? '↑' : '↓'} ${ma}(${c.slow})`
  const sign = { cross: 'kesişme', up: 'yukarı keser', down: 'aşağı keser', gt: '>', lt: '<' }[op]
  return `${SRC_LABEL[src]} ${sign} ${rhs === 'ema' ? `EMA(${c.value})` : c.value}`
}
export const alertText = (a: Alert) => `${a.conds.map(condText).join(a.op === 'AND' ? ' VE ' : ' VEYA ')} (${a.tf})`

export type Step = 'fire' | 'rearm' | 'expire'
/** Koşul sonucuna göre alarmın bir sonraki durumu: tetikle, yeniden kur, süresi doldu veya değişiklik yok. */
export function nextStep(a: Alert, ok: boolean, now: number): Step | null {
  if (a.expires && now > a.expires) return 'expire'
  if (!a.repeat) return ok ? 'fire' : null
  if (a.armed === false) return ok ? null : 'rearm'
  return ok ? 'fire' : null
}
export function applyStep(a: Alert, step: Step, now: number): Alert {
  if (step === 'expire') return { ...a, active: false }
  if (step === 'rearm') return { ...a, armed: true }
  return a.repeat ? { ...a, armed: false, triggeredAt: now } : { ...a, active: false, triggeredAt: now }
}

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
  const prev = closes[n - 2]
  const crossed = (a0: number | undefined, a1: number | undefined, b0: number | undefined, b1: number | undefined, up: boolean) =>
    a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined ? undefined : up ? a0 <= b0 && a1 > b1 : a0 >= b0 && a1 < b1
  switch (c.kind) {
    case 'price_above': case 'price_below': return cmp(p, c.value)
    case 'change_above': case 'change_below': return cmp(change, c.value)
    case 'rsi_above': case 'rsi_below': return cmp(rsi14(closes), c.value)
    case 'ema_above': case 'ema_below': return cmp(p, avg(closes, c.value, n, 'EMA'))
    case 'price_up': case 'price_down': return crossed(prev, p, c.value, c.value, c.kind === 'price_up')
    case 'ema_up': case 'ema_down': return crossed(prev, p, avg(closes, c.value, n - 1, 'EMA'), avg(closes, c.value, n, 'EMA'), c.kind === 'ema_up')
    case 'rsi_up': case 'rsi_down': return crossed(rsi14(closes.slice(0, -1)), rsi14(closes), c.value, c.value, c.kind === 'rsi_up')
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
