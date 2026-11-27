import { useState, type ReactNode } from 'react'
import Modal from './Modal'
import { DEFAULT_LOOK, useApp, type ChartLook } from '../store/app'
import { usePaper } from '../store/paper'
import { askNotificationPermission, beep, telegram } from '../lib/notify'
import CloudSyncSection from './CloudSyncSection'
import type { CandleKind } from '../types'

type Tab = 'symbol' | 'status' | 'scale' | 'canvas' | 'alert' | 'data'
const TABS: [Tab, string][] = [['symbol', 'Sembol'], ['status', 'Durum çizgisi'], ['scale', 'Ölçekler'], ['canvas', 'Kanvas'], ['alert', 'Alarmlar'], ['data', 'Veri']]
const KINDS: [CandleKind, string][] = [['candle', 'Mum'], ['hollow', 'Hollow'], ['heikin', 'Heikin Ashi'], ['line', 'Çizgi'], ['area', 'Alan']]
type Flag = { [K in keyof ChartLook]: ChartLook[K] extends boolean ? K : never }[keyof ChartLook]
type Color = { [K in keyof ChartLook]: ChartLook[K] extends string ? K : never }[keyof ChartLook]

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="flex items-center gap-2 min-h-7"><span className="flex-1">{label}</span>{children}</label>
)

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, setSettings, look, candleKind, logScale, percentScale, magnet, drawColor, drawSize, set } = useApp()
  const reset = usePaper((s) => s.reset)
  const [tab, setTab] = useState<Tab>('symbol')
  const [msg, setMsg] = useState('')
  const setLook = (p: Partial<ChartLook>) => set({ look: { ...look, ...p } })
  const flag = (label: string, key: Flag) => <Row label={label}><input type="checkbox" checked={look[key]} onChange={(e) => setLook({ [key]: e.target.checked })} /></Row>
  const color = (label: string, key: Color) => <Row label={label}><input type="color" className="w-8 h-7 bg-transparent" value={look[key]} onChange={(e) => setLook({ [key]: e.target.value })} /></Row>
  const check = (label: string, checked: boolean, on: (v: boolean) => void) => <Row label={label}><input type="checkbox" checked={checked} onChange={(e) => on(e.target.checked)} /></Row>
  const field = (label: string, key: 'proxyUrl' | 'tgToken' | 'tgChat', ph: string, type = 'text') => (
    <label className="block space-y-1">
      <span className="text-mute">{label}</span>
      <input className="inp" type={type} placeholder={ph} value={settings[key]} onChange={(e) => setSettings({ [key]: e.target.value })} />
    </label>
  )
  const test = async () => {
    const ok = await telegram(settings.tgToken, settings.tgChat, '✅ King of Trade test mesajı').catch(() => false)
    setMsg(ok ? 'Telegram mesajı gönderildi' : 'Gönderilemedi: Token / Chat ID kontrol edin')
  }
  return (
    <Modal title="Ayarlar" onClose={onClose}>
      <div className="text-xs">
        <div className="flex border-b border-line mb-3 overflow-x-auto no-scrollbar">
          {TABS.map(([k, l]) => <button key={k} className={`tab whitespace-nowrap px-2 ${tab === k ? 'tab-on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        <div className="space-y-1.5 min-h-[260px]">
          {tab === 'symbol' && (
            <>
              <Row label="Grafik tipi">
                <select className="inp w-32" value={candleKind} onChange={(e) => set({ candleKind: e.target.value as CandleKind })}>
                  {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </Row>
              {color('Yükseliş rengi (gövde, kenar, fitil)', 'up')}
              {color('Düşüş rengi (gövde, kenar, fitil)', 'down')}
              {flag('Son fiyat çizgisi', 'priceLine')}
              {flag('En yüksek / en düşük fiyat işaretleri', 'highLow')}
            </>
          )}
          {tab === 'status' && (
            <>
              {flag('Şirket / sembol adı', 'showName')}
              {flag('Açık piyasa durumu', 'showStatus')}
              {flag('Grafik değerleri (A, Y, D, K, hacim)', 'ohlc')}
              {flag('Değişim değeri', 'showChange')}
              {flag('İndikatör başlıkları, değerleri ve düğmeleri', 'indValues')}
              {!look.indValues && <p className="text-mute">Kapalıyken grafik üzerindeki ⚙ ◐ ✕ düğmeleri de gizlenir; ayarlara İndikatör menüsünden ulaşılır.</p>}
            </>
          )}
          {tab === 'scale' && (
            <>
              {check('Logaritmik ölçek', logScale, (v) => set({ logScale: v }))}
              {check('Yüzde ölçeği', percentScale, (v) => set({ percentScale: v }))}
              {flag('Yatay ızgara çizgileri', 'gridH')}
              {flag('Dikey ızgara çizgileri', 'gridV')}
              {flag('Artı imleç', 'crosshair')}
              <Row label="Eksen yazı boyutu">
                <select className="inp w-20" value={look.fontSize} onChange={(e) => setLook({ fontSize: +e.target.value })}>
                  {[10, 11, 12, 13, 14, 16].map((n) => <option key={n} value={n}>{n}px</option>)}
                </select>
              </Row>
            </>
          )}
          {tab === 'canvas' && (
            <>
              {color('Arka plan rengi', 'bg')}
              {color('Izgara rengi', 'gridColor')}
              {color('Eksen yazı rengi', 'axisText')}
              {check('Çizimde mıknatıs modu', magnet, (v) => set({ magnet: v }))}
              <Row label="Varsayılan çizim rengi"><input type="color" className="w-8 h-7 bg-transparent" value={drawColor} onChange={(e) => set({ drawColor: e.target.value })} /></Row>
              <Row label="Varsayılan çizgi kalınlığı">
                <select className="inp w-20" value={drawSize} onChange={(e) => set({ drawSize: +e.target.value })}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}px</option>)}
                </select>
              </Row>
            </>
          )}
          {tab === 'alert' && (
            <div className="space-y-2">
              {check('Sesli uyarı', settings.sound !== false, (v) => (setSettings({ sound: v }), v && beep()))}
              {check('Tarayıcı bildirimi', settings.notify !== false, (v) => (setSettings({ notify: v }), v && askNotificationPermission()))}
              {field('Telegram Bot Token', 'tgToken', '123456:ABC…', 'password')}
              {field('Telegram Chat ID', 'tgChat', '123456789')}
              <button className="btn border border-line" onClick={test}>Telegram Test</button>
              {msg && <p className="text-mute">{msg}</p>}
              <p className="text-mute">Telegram bilgileri girildiğinde alarmlar uygulama kapalıyken de sunucudan gönderilir.</p>
            </div>
          )}
          {tab === 'data' && (
            <div className="space-y-3">
              {field('Veri Proxy URL (isteğe bağlı)', 'proxyUrl', 'Boş: varsayılan sunucu kullanılır')}
              <p className="text-mute">Boş bırakılırsa uygulamayla gelen Cloudflare Worker kullanılır; o da yanıt vermezse genel CORS proxy’leri ve anlık görüntü yedek olarak devreye girer.</p>
              <hr className="border-line" />
              <CloudSyncSection />
              <hr className="border-line" />
              <button className="btn border border-down text-down" onClick={() => confirm('Paper trading hesapları sıfırlansın mı?') && reset()}>Paper Trading’i Sıfırla</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-4 pt-3 border-t border-line">
          <button className="btn border border-line" onClick={() => confirm('Grafik görünüm ayarları varsayılana dönsün mü?') && set({ look: DEFAULT_LOOK })}>Görünümü sıfırla</button>
          <button className="btn bg-acc text-white px-4 ml-auto" onClick={onClose}>Tamam</button>
        </div>
      </div>
    </Modal>
  )
}
