import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Görünen alan yüksekliği (adres çubuğu, klavye ve döndürme dahil) doğrudan ölçülür; böylece alt çubuklar her zaman
// ekranın içinde ve dokunulan yerle aynı hizada kalır.
function fitViewport() {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`)
  window.scrollTo(0, 0)
}
fitViewport()
window.visualViewport?.addEventListener('resize', fitViewport)
window.addEventListener('resize', fitViewport)
window.addEventListener('orientationchange', () => setTimeout(fitViewport, 300))

registerSW({ immediate: true })
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
