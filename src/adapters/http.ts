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

const DEFAULT_PROXY: string = import.meta.env.VITE_PROXY_URL || ''

/** Kendi Worker adresi: ayarlardaki değer, yoksa derlemeyle gelen varsayılan. */
export const workerUrl = () => (useApp.getState().settings.proxyUrl.trim() || DEFAULT_PROXY).replace(/\/+$/, '')

/** Canlı kaynak (native HTTP veya kendi proxy'miz) tanımlı mı? */
export const hasLiveSource = () => Capacitor.isNativePlatform() || !!workerUrl()

function proxies(): Proxy[] {
  if (Capacitor.isNativePlatform()) return [{ wrap: (u) => u }]
  const own = workerUrl()
  return own ? [{ wrap: (u) => `${own}/?url=${enc(u)}` }, ...PUBLIC] : PUBLIC
}

export async function getJson(url: string, timeout = TIMEOUT): Promise<unknown> {
  const r = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

const markProxy = (down: boolean) => useApp.getState().proxyDown !== down && useApp.getState().set({ proxyDown: down })

async function tryAll(url: string): Promise<unknown> {
  const ps = proxies()
  const own = !Capacitor.isNativePlatform() && !!workerUrl()
  let err: unknown
  for (let n = 0; n < ps.length; n++) {
    const i = own ? n : (n + preferred) % ps.length
    try {
      const body = await getJson(ps[i].wrap(url))
      const j = ps[i].unwrap ? ps[i].unwrap!(body) : body
      if (own) markProxy(i !== 0)
      else preferred = i
      return j
    } catch (e) {
      err = e
      if (own && i === 0) markProxy(true)
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
