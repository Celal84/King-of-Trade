export interface SavedDrawing {
  name: string
  points: { timestamp: number; value: number }[]
  extendData?: unknown
}

const key = (s: string) => `kot:draw:${s}`

export function loadDrawings(symbol: string): SavedDrawing[] {
  try {
    return JSON.parse(localStorage.getItem(key(symbol)) ?? '[]') as SavedDrawing[]
  } catch {
    return []
  }
}

export function saveDrawings(symbol: string, list: SavedDrawing[]) {
  if (list.length) localStorage.setItem(key(symbol), JSON.stringify(list))
  else localStorage.removeItem(key(symbol))
}
