# King of Trade

BIST 100, Emtia, Sentetik TR pariteleri ve canlı Kripto destekli, açık kaynak finansal terminal. GitHub Pages (Web/PWA) ve Android APK (Capacitor) olarak çalışır.

## Özellikler
- **Veri:** Binance REST + WebSocket (kripto, canlı), Yahoo Finance v8 (BIST, emtia, döviz; 60 sn önbellek), istemci tarafı sentetik pariteler (`GAUTRY`, `XAGTRY`, `XU100USD`).
- **Grafik:** `klinecharts` — 1m…1w, Mum / Hollow / Heikin Ashi / Çizgi / Alan, logaritmik ölçek, tüm yerleşik indikatörler + ATR, 1x1 / 1x2 / 2x2 düzen.
- **Çizim:** Trend, Işın, Yatay/Dikey, Paralel Kanal, Fibonacci, Fiyat Ölçer, Metin; mıknatıs, gizle/göster, temizle; sembol bazlı kalıcı.
- **Paneller:** İzleme listesi (favoriler + kategoriler), Temel analiz (F/K, PD/DD, piyasa değeri, 52H), çift cüzdanlı Paper Trading (100.000 TL + 10.000 USDT, piyasa/limit).
- **Bar Replay:** mum seçimi, oynat/duraklat, 1 mum ileri, 1x/2x/5x.
- **Alarmlar:** Fiyat > / < ve RSI(14); ses + tarayıcı bildirimi + Telegram.
- **Kısayol:** `Ctrl+K` sembol arama.

## Geliştirme
```bash
npm ci
npm run dev
npm run build
```

## Yahoo Proxy (önerilir)
Tarayıcıda Yahoo Finance CORS engeli nedeniyle bir proxy gerekir. `worker/yahoo-proxy.js` dosyasını ücretsiz bir Cloudflare Worker olarak yayınlayın ve URL'yi uygulamada **Ayarlar → Yahoo Proxy URL** alanına girin. Boş bırakılırsa genel CORS proxy'leri yedekli denenir (güvenilir değildir). Android APK'da istekler native HTTP ile gittiği için proxy gerekmez.

## Dağıtım
- **Web:** `main` dalına push → `.github/workflows/deploy-web.yml` → GitHub Pages. (Repo Ayarları → Pages → Source: *GitHub Actions*.)
- **APK:** `main` push veya manuel tetikleme → `.github/workflows/build-apk.yml` → `KingOfTrade-debug.apk` artifact.

## Lisans
MIT
