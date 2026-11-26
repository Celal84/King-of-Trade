import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { applyUpdate, latestVersion } from '../lib/update'

export default function UpdateButton() {
  const [version, setVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    latestVersion().then(setVersion).catch(() => undefined)
  }, [])
  const run = () => {
    setBusy(true)
    applyUpdate(version).finally(() => setBusy(false))
  }
  return (
    <button className={`btn ${version ? 'btn-on' : ''}`} onClick={run} disabled={busy} title={version ? `Yeni sürüm: v${version}` : 'Önbelleği temizle ve yeniden yükle'}>
      <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> {version ? `Güncelle v${version}` : 'Güncelle'}
    </button>
  )
}
