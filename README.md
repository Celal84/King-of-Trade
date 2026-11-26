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
- **Bar Replay**, `Ctrl+K` sembol arama, başlıkta **Güncelle** butonu (yeni sürüm kontrolü, önbellek temizleme).
- **Ek araçlar:** fırça ile serbest çizim, emoji, XABCD formasyonu, geri al / yinele, tarihe git, saat (UTC+3), yüzde ölçeği, ₺ / $ / € hızlı düğmeleri, üst çubukta şablon kaydetme, grafik görünüm ayarları (ızgara, renkler, fiyat çizgisi), piyasa açık/kapalı göstergesi.
- **İndikatör ayar penceresi:** Girdiler (adlandırılmış parametreler, periyot ekle/kaldır), Stil (çizgi başına görünürlük, renk, kalınlık, düz/kesikli), Görünürlük (zaman dilimine göre); İptal / Tamam / sıfırla.
- **Genel ayarlar:** Sembol, Durum çizgisi, Ölçekler, Kanvas, Alarmlar ve Veri sekmeleri (renkler, ızgara, artı imleç, yazı boyutu, arka plan, başlık öğeleri, ses/bildirim).
- **Sunucu taraflı alarmlar:** fiyat, RSI, günlük % değişim, EMA üstü/altı, EMA/SMA kesişimi, yatay çizgiye dokunma; VE/VEYA ile çoklu koşul. Alarmlar Cloudflare Worker'da saklanır, uygulama kapalıyken de Telegram'a gönderilir.
- **Çok koşullu tarama:** alan + operatör + değer satırları (ör. F/K < 10, RSI < 30), isimle kaydedilen filtreler.
- **Bulut senkronu:** listeler, çizimler, şablonlar, tarama filtreleri, Pine scriptleri ve sanal portföy "senkron kodu" ile yedeklenir ve başka cihazda geri yüklenir.
- **Strateji testi:** indikatör kurallarıyla al/sat, komisyon, toplam getiri, kazanma oranı, maksimum düşüş; işlemler grafikte işaretlenir.
- **Pine Script editörü:** PineTS ile tarayıcıda çalışır; `plot()` çıktıları grafiğe çizilir, `input()` değerleri ayarlardan değiştirilir, scriptler "Benim İndikatörlerim" altında saklanır.

## Geliştirme
```bash
npm ci
npm run dev
npm run build
```

## Veri ve Cloudflare Worker
Tarayıcıda Yahoo Finance CORS engeli vardır. Uygulama sırayla şu kaynakları kullanır:
1. **Android APK:** istekler native HTTP ile doğrudan gider.
2. **Kendi Worker'ı (varsayılan):** `worker/` klasörü `deploy-worker.yml` ile Cloudflare'e deploy edilir; adresi derleme sırasında otomatik bulunur. Aynı Worker alarmları (KV + 5 dakikalık tek cron) ve bulut senkronunu da sunar.
3. **Yedekler:** Worker yanıt vermezse genel CORS proxy'leri ve yaklaşık 15 dakikada bir üretilen anlık görüntü (`data/`) kullanılır; ekranda uyarı ve "⏱ gecikmeli" etiketi görünür.

Gerekli repo secret'ları: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` ("Edit Cloudflare Workers" şablonu). Ücretsiz plan sınırlarına göre tasarlanmıştır: alarmlar toplu istekle kontrol edilir, KV'ye yalnızca alarm tetiklenince veya kullanıcı değişiklik yapınca yazılır.

Yahoo'nun BIST verisi kaynağında da yaklaşık 15 dakika gecikmelidir. Kripto verisi Binance'ten canlı gelir.

## Dağıtım
- **Web:** `main` dalına push → `.github/workflows/deploy-web.yml` → GitHub Pages. (Repo Ayarları → Pages → Source: *GitHub Actions*.)
- **APK:** `main` push veya manuel tetikleme → `.github/workflows/build-apk.yml` → `KingOfTrade_vX.Y.Z.apk` (GitHub release).
- **Worker:** `worker/` değişince → `.github/workflows/deploy-worker.yml` → Cloudflare Workers.

## Lisans
Bu repodaki kod MIT lisanslıdır. Pine Script editörü [PineTS](https://github.com/LuxAlgo/PineTS) (AGPL-3.0) kütüphanesini kullanır; bu yüzden derlenmiş uygulamanın dağıtımı AGPL-3.0 koşullarına tabidir (kaynak kodu bu repoda açıktır).
