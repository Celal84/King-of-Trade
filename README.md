# King of Trade

BIST 100, Emtia, Sentetik TR pariteleri ve canlı Kripto destekli, açık kaynak finansal terminal. GitHub Pages (Web/PWA) ve Android APK (Capacitor) olarak çalışır.

## Özellikler
- **Kapsam:** tüm BIST hisseleri (600+), 34 endeks grubu (BIST 30/50/100, Banka, Sınai, Katılım…), emtia, döviz, küresel endeksler, sentetik TR pariteleri, kripto.
- **Veri:** Binance REST + WebSocket (kripto, canlı), Yahoo Finance (mum verisi), toplu tarama kaynağından BIST fiyat/temel/performans verisi.
- **Para birimi:** her grafik TL, USD veya EUR bazında görüntülenebilir (zaman hizalamalı kur dönüşümü).
- **Grafik:** `klinecharts` — 1m…1w, Mum / Hollow / Heikin Ashi / Çizgi / Alan, logaritmik ölçek, tüm yerleşik indikatörler + ATR, 1x1 / 1x2 / 2x2 düzen; hazır aralıklar (1G…Tümü), yakınlaştırma ve fiyat ölçeği kontrolleri.
- **Çizim:** Trend, Işın, Yatay/Dikey, Paralel Kanal, Fibonacci, Fiyat Ölçer, Metin; mıknatıs, gizle/göster, temizle; sembol bazlı kalıcı.
- **Paneller:** İzleme listesi (endeks grubu filtresi), BIST Tarama (performans, hacim, F/K, RSI… sıralama ve hazır taramalar), Temel analiz (değerleme, kârlılık, performans, endeks üyelikleri), çift cüzdanlı Paper Trading.
- **Bar Replay**, **Alarmlar** (fiyat ve RSI; ses + bildirim + Telegram), `Ctrl+K` sembol arama.

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
