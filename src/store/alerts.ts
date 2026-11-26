import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Alert, AlertTf, Cond, CondKind } from '../lib/alertEval'

export type CloudState = 'off' | 'ok' | 'err'
type NewAlert = Pick<Alert, 'symbol' | 'tf' | 'op' | 'conds'>

interface AlertState {
  alerts: Alert[]
  deleted: string[]
  cloud: CloudState
  add: (a: NewAlert) => void
  remove: (id: string) => void
  trigger: (id: string, at?: number) => void
  rearm: (id: string) => void
}

const SNAP: Record<string, AlertTf> = { '1m': '5m', '5m': '5m', '15m': '15m', '30m': '15m', '1h': '1h', '2h': '1h', '4h': '1h' }
export const alertTf = (tf: string): AlertTf => SNAP[tf] ?? '1d'
const patch = (list: Alert[], id: string, p: Partial<Alert>) => list.map((a) => (a.id === id ? { ...a, ...p } : a))

export const useAlerts = create<AlertState>()(
  persist(
    (set) => ({
      alerts: [],
      deleted: [],
      cloud: 'off',
      add: (a) => set((s) => ({ alerts: [...s.alerts, { ...a, id: Math.random().toString(36).slice(2, 10), active: true }] })),
      remove: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id), deleted: [...s.deleted, id].slice(-200) })),
      trigger: (id, at = Date.now()) => set((s) => ({ alerts: patch(s.alerts, id, { active: false, triggeredAt: at }) })),
      rearm: (id) => set((s) => ({ alerts: patch(s.alerts, id, { active: true, triggeredAt: undefined }) })),
    }),
    {
      name: 'kot:alerts',
      version: 1,
      migrate: (old) => {
        const o = old as { alerts?: (Partial<Alert> & { kind?: CondKind; value?: number })[] }
        const alerts = (o.alerts ?? []).map((a) => ({
          id: a.id ?? '', symbol: a.symbol ?? '', tf: alertTf(a.tf ?? '1d'), op: a.op ?? 'AND', active: !!a.active, triggeredAt: a.triggeredAt,
          conds: a.conds ?? ([{ kind: a.kind ?? 'price_above', value: a.value ?? 0 }] as Cond[]),
        }))
        return { alerts, deleted: [] } as unknown as AlertState
      },
      partialize: ({ alerts, deleted }) => ({ alerts, deleted }),
    },
  ),
)
