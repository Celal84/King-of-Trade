import { useState } from 'react'
import Modal from './Modal'
import { DEFAULT_LOOK, useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { telegram } from '../lib/notify'
import CloudSyncSection from './CloudSyncSection'

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, setSettings, look, set } = useApp()
  const setLook = (p: Partial<typeof look>) => set({ look: { ...look, ...p } })
  const reset = usePaper((s) => s.reset)
  const [msg, setMsg] = useState('')
  const test = async () => {
    const ok = await telegram(settings.tgToken, settings.tgChat, '✅ King of Trade test mesajı').catch(() => false)
    setMsg(ok ? 'Telegram mesajı gönderildi' : 'Gönderilemedi: Token / Chat ID kontrol edin')
  }
  const field = (label: string, key: 'proxyUrl' | 'tgToken' | 'tgChat', ph: string, type = 'text') => (
    <label className="block space-y-1">
      <span className="text-mute">{label}</span>
      <input className="inp" type={type} placeholder={ph} value={settings[key]} onChange={(e) => setSettings({ [key]: e.target.value })} />
    </label>
  )
  return (
    <Modal title="Ayarlar" onClose={onClose}>
      <div className="space-y-3 text-xs">
        <b>Grafik Görünümü</b>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1"><input type="checkbox" checked={look.grid} onChange={(e) => setLook({ grid: e.target.checked })} /> Izgara</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={look.priceLine} onChange={(e) => setLook({ priceLine: e.target.checked })} /> Son fiyat çizgisi</label>
          <label className="flex items-center gap-1">Yükseliş <input type="color" className="w-7 h-7 bg-transparent" value={look.up} onChange={(e) => setLook({ up: e.target.value })} /></label>
          <label className="flex items-center gap-1">Düşüş <input type="color" className="w-7 h-7 bg-transparent" value={look.down} onChange={(e) => setLook({ down: e.target.value })} /></label>
          <button className="btn border border-line" onClick={() => set({ look: DEFAULT_LOOK })}>Varsayılan</button>
        </div>
        <hr className="border-line" />
        {field('Veri Proxy URL (isteğe bağlı)', 'proxyUrl', 'https://king-of-trade.<hesap>.workers.dev')}
        <p className="text-mute">Boş bırakılırsa uygulamayla gelen Cloudflare Worker kullanılır; o da yanıt vermezse genel CORS proxy’leri ve anlık görüntü yedek olarak devreye girer.</p>
        {field('Telegram Bot Token', 'tgToken', '123456:ABC…', 'password')}
        {field('Telegram Chat ID', 'tgChat', '123456789')}
        <button className="btn border border-line" onClick={test}>Telegram Test</button>
        {msg && <p className="text-mute">{msg}</p>}
        <hr className="border-line" />
        <CloudSyncSection />
        <hr className="border-line" />
        <button className="btn border border-down text-down" onClick={() => confirm('Paper trading hesapları sıfırlansın mı?') && reset()}>Paper Trading’i Sıfırla</button>
      </div>
    </Modal>
  )
}
