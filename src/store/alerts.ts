import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Timeframe } from '../types'

export type AlertKind = 'price_above' | 'price_below' | 'rsi_below' | 'rsi_above' | 'change_above' | 'change_below' | 'ema_above' | 'ema_below'
export const ALERT_LABEL: Record<AlertKind, string> = {
  price_above: 'Fiyat >', price_below: 'Fiyat <', rsi_below: 'RSI(14) <', rsi_above: 'RSI(14) >',
  change_above: 'Günlük değişim % >', change_below: 'Günlük değişim % <', ema_above: 'Fiyat, EMA(n) üstünde; n =', ema_below: 'Fiyat, EMA(n) altında; n =',
}

export interface Alert {
  id: string
  symbol: string
  kind: AlertKind
  value: number
  tf: Timeframe
  active: boolean
  triggeredAt?: number
}

interface AlertState {
  alerts: Alert[]
  add: (a: Omit<Alert, 'id' | 'active'>) => void
  remove: (id: string) => void
  trigger: (id: string) => void
}

export const useAlerts = create<AlertState>()(
  persist(
    (set) => ({
      alerts: [],
      add: (a) => set((s) => ({ alerts: [...s.alerts, { ...a, id: Math.random().toString(36).slice(2, 10), active: true }] })),
      remove: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
      trigger: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, active: false, triggeredAt: Date.now() } : a)) })),
    }),
    { name: 'kot:alerts' },
  ),
)
