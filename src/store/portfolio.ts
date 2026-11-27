import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Tx { id: string; symbol: string; side: 'buy' | 'sell'; qty: number; price: number; date: number; note?: string }
export interface Position { symbol: string; qty: number; avg: number; cost: number; realized: number; since: number }

interface PortfolioState {
  txs: Tx[]
  /** Elle girilen nakit bakiye (TL). */
  cash: number
  save: (tx: Omit<Tx, 'id'> & { id?: string }) => void
  remove: (id: string) => void
  removeSymbol: (symbol: string) => void
  setCash: (v: number) => void
}

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set) => ({
      txs: [],
      cash: 0,
      save: (tx) => set((s) => {
        const id = tx.id ?? Math.random().toString(36).slice(2, 10)
        return { txs: [...s.txs.filter((t) => t.id !== id), { ...tx, id }].sort((a, b) => a.date - b.date) }
      }),
      remove: (id) => set((s) => ({ txs: s.txs.filter((t) => t.id !== id) })),
      removeSymbol: (symbol) => set((s) => ({ txs: s.txs.filter((t) => t.symbol !== symbol) })),
      setCash: (cash) => set({ cash }),
    }),
    { name: 'kot:pf' },
  ),
)

/** İşlemlerden açık pozisyonları türetir: ağırlıklı ortalama maliyet; satışta gerçekleşen kâr/zarar ayrılır. */
export function positionsOf(txs: Tx[]): Position[] {
  const map = new Map<string, Position>()
  for (const t of [...txs].sort((a, b) => a.date - b.date)) {
    const p = map.get(t.symbol) ?? { symbol: t.symbol, qty: 0, avg: 0, cost: 0, realized: 0, since: t.date }
    if (t.side === 'buy') {
      if (p.qty <= 0) p.since = t.date
      p.qty += t.qty
      p.cost += t.qty * t.price
    } else {
      const q = Math.min(t.qty, p.qty)
      p.realized += (t.price - p.avg) * q
      p.qty -= q
      p.cost -= p.avg * q
    }
    p.avg = p.qty > 0 ? p.cost / p.qty : 0
    if (p.qty <= 1e-9) [p.qty, p.cost] = [0, 0]
    map.set(t.symbol, p)
  }
  return [...map.values()]
}
