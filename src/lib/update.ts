import { Capacitor } from '@capacitor/core'
import pkg from '../../package.json'
import { getJson } from '../adapters/http'

const REPO = 'Celal84/King-of-Trade'
const num = (v: string) => v.split('.').map(Number)
const newer = (a: string, b: string) => {
  const [x, y] = [num(a), num(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

/** GitHub'daki son sürüm bu sürümden yeniyse sürüm numarasını döner. */
export async function latestVersion(): Promise<string | null> {
  const j = (await getJson(`https://api.github.com/repos/${REPO}/releases/latest`)) as { tag_name?: string }
  const v = j.tag_name?.match(/(\d+\.\d+\.\d+)/)?.[1]
  return v && newer(v, pkg.version) ? v : null
}

export async function applyUpdate(version: string | null) {
  if (Capacitor.isNativePlatform()) {
    const v = version ?? pkg.version
    window.open(`https://github.com/${REPO}/releases/download/KingOfTrade_v${v}/KingOfTrade_v${v}.apk`, '_system')
    return
  }
  const regs = (await navigator.serviceWorker?.getRegistrations().catch(() => [])) ?? []
  await Promise.all(regs.map((r) => r.unregister()))
  if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)))
  location.replace(`${location.pathname}?v=${Date.now()}`)
}
