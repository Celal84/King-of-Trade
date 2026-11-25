import { Capacitor } from '@capacitor/core'
import { useApp } from '../store/app'

interface Proxy {
  wrap: (url: string) => string
  unwrap?: (body: unknown) => unknown
}

const enc = encodeURIComponent
const PUBLIC: Proxy[] = [
  { wrap: (u) => `https://api.allorigins.win/get?url=${enc(u)}`, unwrap: (b) => JSON.parse((b as { contents: string }).contents) },
  { wrap: (u) => `https://api.allorigins.win/raw?url=${enc(u)}` },
  { wrap: (u) => `https://api.codetabs.com/v1/proxy?quest=${enc(u)}` },
]
const TTL = 60_000
const TIMEOUT = 8_000
const cache = new Map<string, { t: number; p: Promise<unknown> }>()
let preferred = 0

const customProxy = () => useApp.getState().settings.proxyUrl.trim()

/** Canlı kaynak (native HTTP veya kullanıcının proxy'si) tanımlı mı? */
export const hasLiveSource = () => Capacitor.isNativePlatform() || !!customProxy()

function proxies(): Proxy[] {
  if (Capacitor.isNativePlatform()) return [{ wrap: (u) => u }]
  const custom = customProxy()
  return custom ? [{ wrap: (u) => `${custom}${custom.includes('?') ? '&' : '?'}url=${enc(u)}` }] : PUBLIC
}

export async function getJson(url: string, timeout = TIMEOUT): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function tryAll(url: string): Promise<unknown> {
  const ps = proxies()
  let err: unknown
  for (let n = 0; n < ps.length; n++) {
    const i = (n + preferred) % ps.length
    try {
      const body = await getJson(ps[i].wrap(url))
      const j = ps[i].unwrap ? ps[i].unwrap!(body) : body
      preferred = i
      return j
    } catch (e) {
      err = e
    }
  }
  throw err instanceof Error ? err : new Error('Proxy hatası')
}

export function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.t < ttl) return hit.p as Promise<T>
  const p = load()
  cache.set(key, { t: Date.now(), p })
  p.catch(() => cache.delete(key))
  return p
}

export const proxiedJson = <T>(url: string, ttl = TTL): Promise<T> => cached(url, ttl, () => tryAll(url) as Promise<T>)
