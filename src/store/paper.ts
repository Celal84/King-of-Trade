import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quote } from '../types'
import { getSymbol } from '../data/symbols'

// 'USDT' anahtarı USD cüzdanıdır; kayıtlı hesaplarla uyum için adı korunur
export type Wallet = 'TRY' | 'USDT'
export type Side = 'buy' | 'sell'

export interface Position { qty: number; avg: number }
export interface Order { id: string; symbol: string; side: Side; qty: number; price: number; time: number }
export interface Trade extends Order { kind: 'Piyasa' | 'Limit'; pnl?: number }

const INITIAL: Record<Wallet, number> = { TRY: 100_000, USDT: 10_000 }
export const walletOf = (symbol: string): Wallet => (getSymbol(symbol).currency === 'TRY' ? 'TRY' : 'USDT')
const uid = () => Math.random().toString(36).slice(2, 10)

interface PaperState {
  cash: Record<Wallet, number>
  positions: Record<string, Position>
  orders: Order[]
  history: Trade[]
  market: (symbol: string, side: Side, qty: number, price: number) => string | null
  limit: (symbol: string, side: Side, qty: number, price: number) => string | null
  cancel: (id: string) => void
  check: (prices: Record<string, Quote>) => void
  reset: () => void
}

type Data = Pick<PaperState, 'cash' | 'positions' | 'orders' | 'history'>

function fill(s: Data, o: Order, kind: Trade['kind'], reserved: boolean): Data | string {
  const w = walletOf(o.symbol)
  const cost = o.qty * o.price
  const pos = s.positions[o.symbol] ?? { qty: 0, avg: 0 }
  const cash = { ...s.cash }
  const positions = { ...s.positions }
  let pnl: number | undefined
  if (o.side === 'buy') {
    if (!reserved && cash[w] < cost) return 'Yetersiz bakiye'
    if (!reserved) cash[w] -= cost
    const qty = pos.qty + o.qty
    positions[o.symbol] = { qty, avg: (pos.qty * pos.avg + cost) / qty }
  } else {
    if (pos.qty < o.qty - 1e-12) return 'Yetersiz pozisyon'
    cash[w] += cost
    pnl = (o.price - pos.avg) * o.qty
    const qty = pos.qty - o.qty
    if (qty <= 1e-12) delete positions[o.symbol]
    else positions[o.symbol] = { ...pos, qty }
  }
  return { ...s, cash, positions, history: [{ ...o, kind, pnl, time: Date.now() }, ...s.history].slice(0, 300) }
}

export const usePaper = create<PaperState>()(
  persist(
    (set, get) => ({
      cash: { ...INITIAL },
      positions: {},
      orders: [],
      history: [],
      market: (symbol, side, qty, price) => {
        const r = fill(get(), { id: uid(), symbol, side, qty, price, time: Date.now() }, 'Piyasa', false)
        if (typeof r === 'string') return r
        set(r)
        return null
      },
      limit: (symbol, side, qty, price) => {
        const s = get()
        const w = walletOf(symbol)
        const cash = { ...s.cash }
        if (side === 'buy') {
          if (cash[w] < qty * price) return 'Yetersiz bakiye'
          cash[w] -= qty * price
        } else {
          const reserved = s.orders.filter((o) => o.symbol === symbol && o.side === 'sell').reduce((a, o) => a + o.qty, 0)
          if ((s.positions[symbol]?.qty ?? 0) - reserved < qty - 1e-12) return 'Yetersiz pozisyon'
        }
        set({ cash, orders: [...s.orders, { id: uid(), symbol, side, qty, price, time: Date.now() }] })
        return null
      },
      cancel: (id) => {
        const s = get()
        const o = s.orders.find((x) => x.id === id)
        if (!o) return
        const cash = { ...s.cash }
        if (o.side === 'buy') cash[walletOf(o.symbol)] += o.qty * o.price
        set({ cash, orders: s.orders.filter((x) => x.id !== id) })
      },
      check: (prices) => {
        let s: Data = get()
        const remaining: Order[] = []
        for (const o of s.orders) {
          const p = prices[o.symbol]?.price
          const hit = p !== undefined && (o.side === 'buy' ? p <= o.price : p >= o.price)
          const r = hit ? fill(s, o, 'Limit', true) : 'skip'
          if (typeof r === 'string') remaining.push(o)
          else s = r
        }
        if (remaining.length !== get().orders.length) set({ ...s, orders: remaining })
      },
      reset: () => set({ cash: { ...INITIAL }, positions: {}, orders: [], history: [] }),
    }),
    { name: 'kot:paper' },
  ),
)
