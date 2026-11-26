import { useEffect } from 'react'
import { useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { usePine } from '../store/pine'
import { CODE_RE, cloudGet, cloudPut, cloudReady, syncCode } from './cloud'

// Yedeklenen veriler: uygulama deposundan seçili alanlar + ham localStorage anahtarları (çizimler, sanal portföy, Pine scriptleri).
const APP_KEYS = ['lists', 'listIdx', 'templates', 'scans', 'notes', 'indicatorConfig'] as const
const LS_KEYS = ['kot:paper', 'kot:pine']
const LS_PREFIX = 'kot:draw:'
const APP_STORE = 'kot:app'
const DEBOUNCE = 8_000
const MIN_GAP = 60_000
export const DIRTY_EVENT = 'kot:dirty'

interface Backup { t: number; app: Record<string, unknown>; tg: [string, string]; ls: Record<string, string> }

function collect(): Omit<Backup, 't'> {
  const st = useApp.getState()
  const ls: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (k.startsWith(LS_PREFIX) || LS_KEYS.includes(k))) ls[k] = localStorage.getItem(k) ?? ''
  }
  return { app: Object.fromEntries(APP_KEYS.map((k) => [k, st[k]])), tg: [st.settings.tgToken, st.settings.tgChat], ls }
}

/** Yedeği yerel depoya yazar ve sayfayı yeniden yükler. */
function apply(b: Backup, code: string) {
  Object.keys(localStorage).filter((k) => k.startsWith(LS_PREFIX)).forEach((k) => localStorage.removeItem(k))
  Object.entries(b.ls).forEach(([k, v]) => localStorage.setItem(k, v))
  const saved = JSON.parse(localStorage.getItem(APP_STORE) ?? '{"state":{},"version":1}') as { state: Record<string, unknown> }
  const settings = { ...useApp.getState().settings, syncCode: code, syncOn: true, syncAt: b.t, ...(b.tg[0] ? { tgToken: b.tg[0], tgChat: b.tg[1] } : {}) }
  saved.state = { ...saved.state, ...b.app, settings }
  localStorage.setItem(APP_STORE, JSON.stringify(saved))
  location.reload()
}

let pushed = ''
let lastPush = 0

export async function backup(force = false): Promise<void> {
  const data = collect()
  const body = JSON.stringify(data)
  if (!force && body === pushed) return
  const t = Date.now()
  await cloudPut('u', { t, ...data })
  pushed = body
  lastPush = t
  useApp.getState().setSettings({ syncAt: t })
}

/** Kodla geri yükleme: başarılıysa sayfa yeniden yüklenir, yedek yoksa false döner. */
export async function restore(code: string): Promise<boolean> {
  if (!CODE_RE.test(code)) return false
  const b = await cloudGet<Backup>('u', code)
  if (!b) return false
  apply(b, code)
  return true
}

export function useCloudSync() {
  const on = useApp((s) => !!s.settings.syncOn)
  useEffect(() => {
    if (!on || !cloudReady()) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let ready = false
    const schedule = () => {
      if (!ready) return
      clearTimeout(timer)
      timer = setTimeout(() => backup().catch(() => undefined), Math.max(DEBOUNCE, lastPush + MIN_GAP - Date.now()))
    }
    cloudGet<Backup>('u').then((b) => {
      const code = syncCode()
      if (b && b.t > (useApp.getState().settings.syncAt ?? 0)) return apply(b, code)
      pushed = b ? JSON.stringify({ app: b.app, tg: b.tg, ls: b.ls }) : ''
      ready = true
      schedule()
    }).catch(() => {
      ready = true
    })
    const unsub = [useApp.subscribe(schedule), usePaper.subscribe(schedule), usePine.subscribe(schedule)]
    window.addEventListener(DIRTY_EVENT, schedule)
    return () => {
      clearTimeout(timer)
      unsub.forEach((u) => u())
      window.removeEventListener(DIRTY_EVENT, schedule)
    }
  }, [on])
}
