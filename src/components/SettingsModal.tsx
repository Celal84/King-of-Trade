import { useState } from 'react'
import Modal from './Modal'
import { useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { telegram } from '../lib/notify'

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, setSettings } = useApp()
  const reset = usePaper((s) => s.reset)
  const [msg, setMsg] = useState('')
  const test = async () => {
    const ok = await telegram(settings.tgToken, settings.tgChat, '✅ King of Trade test mesajı').catch(() => false)
    setMsg(ok ? 'Telegram mesajı gönderildi' : 'Gönderilemedi: Token / Chat ID kontrol edin')
  }
  const field = (label: string, key: keyof typeof settings, ph: string, type = 'text') => (
    <label className="block space-y-1">
      <span className="text-mute">{label}</span>
      <input className="inp" type={type} placeholder={ph} value={settings[key]} onChange={(e) => setSettings({ [key]: e.target.value })} />
    </label>
  )
  return (
    <Modal title="Ayarlar" onClose={onClose}>
      <div className="space-y-3 text-xs">
        {field('Yahoo Proxy URL (Cloudflare Worker)', 'proxyUrl', 'https://yahoo-proxy.<hesap>.workers.dev')}
        <p className="text-mute">Boş bırakılırsa genel CORS proxy’leri (yedekli) kullanılır. Kendi proxy’niz için repodaki <code>worker/yahoo-proxy.js</code> dosyasını Cloudflare Workers’a yükleyin.</p>
        {field('Telegram Bot Token', 'tgToken', '123456:ABC…', 'password')}
        {field('Telegram Chat ID', 'tgChat', '123456789')}
        <button className="btn border border-line" onClick={test}>Telegram Test</button>
        {msg && <p className="text-mute">{msg}</p>}
        <hr className="border-line" />
        <button className="btn border border-down text-down" onClick={() => confirm('Paper trading hesapları sıfırlansın mı?') && reset()}>Paper Trading’i Sıfırla</button>
      </div>
    </Modal>
  )
}
