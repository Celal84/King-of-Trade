import { Capacitor } from '@capacitor/core'
import { useApp } from '../store/app'

type Wrap = (url: string) => string
const enc = encodeURIComponent
const FALLBACKS: Wrap[] = [(u) => `https://corsproxy.io/?url=${enc(u)}`, (u) => `https://api.allorigins.win/raw?url=${enc(u)}`, (u) => `https://api.codetabs.com/v1/proxy?quest=${enc(u)}`]
const TTL = 60_000
const cache = new Map<string, { t: number; p: Promise<unknown> }>()
let preferred = 0

function wrappers(): Wrap[] {
  const custom = useApp.getState().settings.proxyUrl.trim()
  const list: Wrap[] = []
  if (Capacitor.isNativePlatform()) list.push((u) => u)
  if (custom) list.push((u) => `${custom}${custom.includes('?') ? '&' : '?'}url=${enc(u)}`)
  return [...list, ...FALLBACKS]
}

async function tryAll(url: string): Promise<unknown> {
  const ws = wrappers()
  const order = ws.map((_, i) => (i + preferred) % ws.length)
  let err: unknown
  for (const i of order) {
    try {
      const r = await fetch(ws[i](url))
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const j = await r.json()
      preferred = i
      return j
    } catch (e) {
      err = e
    }
  }
  throw err instanceof Error ? err : new Error('Proxy hatası')
}

export function proxiedJson<T>(url: string, ttl = TTL): Promise<T> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.t < ttl) return hit.p as Promise<T>
  const p = tryAll(url)
  cache.set(url, { t: Date.now(), p })
  p.catch(() => cache.delete(url))
  return p as Promise<T>
}
