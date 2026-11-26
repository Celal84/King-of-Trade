# King of Trade

BIST 100, Emtia, Sentetik TR pariteleri ve canlı Kripto destekli, açık kaynak finansal terminal. GitHub Pages (Web/PWA) ve Android APK (Capacitor) olarak çalışır.

## Özellikler
- **Kapsam:** tüm BIST hisseleri (600+), 34 endeks grubu (BIST 30/50/100, Banka, Sınai, Katılım…), emtia, döviz, küresel endeksler, sentetik TR pariteleri, kripto.
- **Veri:** Binance REST + WebSocket (kripto, canlı), Yahoo Finance (mum verisi), toplu tarama kaynağından BIST fiyat/temel/performans verisi.
- **Para birimi:** her grafik TL, USD veya EUR bazında görüntülenebilir (zaman hizalamalı kur dönüşümü).
- **Grafik:** `klinecharts` — 1m…1w, Mum / Hollow / Heikin Ashi / Çizgi / Alan, logaritmik ölçek, tüm yerleşik indikatörler + ATR, 1x1 / 1x2 / 2x2 düzen; hazır aralıklar (1G…Tümü), yakınlaştırma ve fiyat ölçeği kontrolleri.
- **Çizim:** çizgiler (trend, ışın, uzatılmış, ok, yatay/dikey), kanallar ve Fibonacci, şekiller (dikdörtgen, daire, üçgen), fiyat ölçer, al/sat pozisyonu (R/R), metin/not/etiket; mıknatıs, gizle/göster, geri al, temizle; sembol bazlı kalıcı.
- **Paneller:** İzleme listesi (endeks grubu filtresi), BIST Tarama (performans, hacim, F/K, RSI… sıralama ve hazır taramalar), Temel analiz (değerleme, kârlılık, performans, endeks üyelikleri), çift cüzdanlı Paper Trading.
- **Karşılaştırma:** 4 sembole kadar yüzde ölçeğinde üst üste; **indikatör ayarları** (periyot ve renk); **çoklu izleme listesi**.
- **Kripto:** tüm Binance spot pariteleri (USDT / TRY / USDC / FDUSD), hacme göre listeler ve kripto taraması (canlı).
- **Zaman dilimleri:** 1m, 5m, 15m, 30m, 1h, 2h, 4h, 1d, 1w, 1M; 6 grafiğe kadar çoklu düzen; ekran görüntüsü ve tam ekran.
- **Ek indikatörler:** Hacim Profili (görünen aralık), Pivot Noktaları Standart, Chaikin Money Flow, VWAP, SuperTrend, Ichimoku, Stokastik RSI, MFI, Donchian, Keltner, Hull MA; grafik şablonları.
- **Grafik üzeri indikatör düğmeleri:** her indikatör satırında ayar (⚙), gizle/göster (◐) ve kaldır (✕); Ichimoku bulut dolgusu, pivot dönemi seçimi, sabit aralıklı hacim profili; Fibonacci uzatması, Gann yelpazesi, dalga çizimi; sembol notları.
- **Fiyat cetveli:** sağdaki cetveli parmakla/fareyle sürükleyerek ölçekleme, çift dokunuşla otomatik.
- **Bar Replay**, **Alarmlar** (fiyat, RSI, günlük % değişim, EMA üstü/altı; ses + bildirim + Telegram), `Ctrl+K` sembol arama.

## Geliştirme
```bash
npm ci
npm run dev
npm run build
```

## Yahoo verisi nasıl gelir?
Tarayıcıda Yahoo Finance CORS engeli vardır. Uygulama sırayla şu kaynakları kullanır:
1. **Android APK:** istekler native HTTP ile doğrudan gider.
2. **Özel proxy (canlıya en yakın):** `worker/yahoo-proxy.js` dosyasını ücretsiz bir Cloudflare Worker olarak yayınlayıp URL'yi **Ayarlar → Yahoo Proxy URL** alanına girin.
3. **Anlık görüntü (ayarsız çalışır):** `deploy-web.yml` yaklaşık 15 dakikada bir `scripts/snapshot.mjs` ile BIST hisse listesini, endeks üyeliklerini, fiyat, mum ve temel verileri çekip siteyle birlikte `data/` altında yayınlar. Proxy yoksa uygulama bu veriyi kullanır ve grafikte "⏱ gecikmeli" etiketi gösterir.

Yahoo'nun BIST verisi kaynağında da yaklaşık 15 dakika gecikmelidir. Kripto verisi Binance'ten canlı gelir.

## Dağıtım
- **Web:** `main` dalına push → `.github/workflows/deploy-web.yml` → GitHub Pages. (Repo Ayarları → Pages → Source: *GitHub Actions*.)
- **APK:** `main` push veya manuel tetikleme → `.github/workflows/build-apk.yml` → `KingOfTrade-debug.apk` artifact.

## Lisans
MIT
