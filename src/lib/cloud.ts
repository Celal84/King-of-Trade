import { workerUrl } from '../adapters/http'
import { useApp } from '../store/app'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_RE = /^[A-Z2-9]{20}$/

export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => CHARS[b % CHARS.length]).join('')

/** Bu cihazın senkron kodu; yoksa üretilir. */
export function syncCode(): string {
  const { settings, setSettings } = useApp.getState()
  if (settings.syncCode) return settings.syncCode
  const code = newCode()
  setSettings({ syncCode: code })
  return code
}

export const cloudReady = () => !!workerUrl()
const url = (kind: 'a' | 'u', code: string) => `${workerUrl()}/kv/${kind}?code=${code}`

export async function cloudGet<T>(kind: 'a' | 'u', code = syncCode()): Promise<T | null> {
  const r = await fetch(url(kind, code), { signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as T | null
}

export async function cloudPut(kind: 'a' | 'u', body: unknown, code = syncCode()): Promise<void> {
  const r = await fetch(url(kind, code), { method: 'PUT', body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
}
