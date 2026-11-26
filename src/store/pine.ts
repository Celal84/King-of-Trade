import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PineValues = Record<string, unknown>
export interface PineScript { name: string; code: string; inputs: PineValues; on: boolean }

export const SAMPLE: PineScript = {
  name: 'RSI + SMA Sinyal',
  on: false,
  inputs: {},
  code: `//@version=6
indicator("RSI + SMA Sinyal", overlay=false)
rsiLen = input.int(14, "RSI Periyodu", minval=2)
sigLen = input.int(9, "Sinyal Periyodu", minval=1)
r = ta.rsi(close, rsiLen)
plot(r, "RSI", color=color.purple)
plot(ta.sma(r, sigLen), "Sinyal", color=color.orange)
hline(70, "Aşırı alım")
hline(30, "Aşırı satım")
`,
}

interface PineState {
  scripts: PineScript[]
  /** "Çalıştır" ile grafikte denenen, henüz kaydedilmemiş script. */
  draft: PineScript | null
  setDraft: (d: PineScript | null) => void
  save: (s: PineScript) => void
  remove: (name: string) => void
  toggle: (name: string) => void
  setInputs: (name: string, inputs: PineValues) => void
}

const patch = (list: PineScript[], name: string, fn: (s: PineScript) => PineScript) => list.map((s) => (s.name === name ? fn(s) : s))

export const usePine = create<PineState>()(
  persist(
    (set) => ({
      scripts: [SAMPLE],
      draft: null,
      setDraft: (draft) => set({ draft }),
      save: (s) => set((st) => ({ scripts: st.scripts.some((x) => x.name === s.name) ? patch(st.scripts, s.name, () => s) : [...st.scripts, s], draft: null })),
      remove: (name) => set((st) => ({ scripts: st.scripts.filter((s) => s.name !== name) })),
      toggle: (name) => set((st) => ({ scripts: patch(st.scripts, name, (s) => ({ ...s, on: !s.on })) })),
      setInputs: (name, inputs) => set((st) => ({
        scripts: patch(st.scripts, name, (s) => ({ ...s, inputs })),
        draft: st.draft?.name === name ? { ...st.draft, inputs } : st.draft,
      })),
    }),
    { name: 'kot:pine', partialize: ({ scripts }) => ({ scripts }) },
  ),
)
