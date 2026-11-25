import { create } from 'zustand'

interface ReplayState {
  active: boolean
  selecting: boolean
  playing: boolean
  speed: 1 | 2 | 5
  cursor: number
  pane: number
  length: number
  set: (p: Partial<Omit<ReplayState, 'set'>>) => void
}

export const useReplay = create<ReplayState>()((set) => ({
  active: false, selecting: false, playing: false, speed: 1, cursor: -1, length: 0, pane: 0,
  set: (p) => set(p),
}))
