import { useState } from 'react'
import { useApp } from '../store/app'
import { cloudReady, syncCode } from '../lib/cloud'
import { backup, restore } from '../lib/sync'

export default function CloudSyncSection() {
  const { settings, setSettings } = useApp()
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const run = (job: () => Promise<string>) => {
    setMsg('Çalışıyor…')
    job().then(setMsg, () => setMsg('Sunucuya ulaşılamadı'))
  }
  const enable = () => run(async () => {
    syncCode()
    await backup(true)
    setSettings({ syncOn: true })
    return 'Senkron açıldı; değişiklikler otomatik yedeklenir'
  })
  const load = () => run(async () => {
    const code = input.trim().toUpperCase()
    if (!confirm('Bu cihazdaki listeler, çizimler, şablonlar ve sanal portföy yedektekiyle değiştirilecek. Devam edilsin mi?')) return ''
    return (await restore(code)) ? 'Geri yüklendi' : 'Bu kodla yedek bulunamadı'
  })
  if (!cloudReady()) return <p className="text-mute">Bulut senkronu için veri proxy’si (Worker) gerekli.</p>
  return (
    <div className="space-y-2">
      <b>Bulut Senkronu</b>
      <p className="text-mute">Favori listeleri, çizimler, şablonlar, tarama filtreleri, Pine scriptleri ve sanal portföy yedeklenir. Kodu bilen herkes yedeğe erişebilir; paylaşmayın.</p>
      {settings.syncOn ? (
        <>
          <input className="inp font-mono" readOnly value={settings.syncCode ?? ''} onFocus={(e) => e.target.select()} aria-label="Senkron kodu" />
          <div className="flex gap-1 items-center">
            <button className="btn border border-line" onClick={() => run(() => backup(true).then(() => 'Yedeklendi'))}>Şimdi yedekle</button>
            <button className="btn border border-line" onClick={() => setSettings({ syncOn: false })}>Senkronu kapat</button>
            {settings.syncAt && <span className="text-mute ml-auto">Son: {new Date(settings.syncAt).toLocaleString('tr-TR')}</span>}
          </div>
        </>
      ) : (
        <button className="btn border border-line" onClick={enable}>Senkron kodu oluştur</button>
      )}
      <div className="flex gap-1">
        <input className="inp font-mono" placeholder="Başka cihazdaki senkron kodu" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn border border-line whitespace-nowrap" disabled={!input.trim()} onClick={load}>Kodla geri yükle</button>
      </div>
      {msg && <p className="text-mute">{msg}</p>}
    </div>
  )
}
