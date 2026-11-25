import type { Category, Currency, Source, SymbolInfo } from '../types'

const BIST: [string, string, string][] = [
  ['XU100', 'BIST 100 Endeksi', 'Endeks'], ['XU030', 'BIST 30 Endeksi', 'Endeks'],
  ['THYAO', 'Türk Hava Yolları', 'Ulaştırma'], ['PGSUS', 'Pegasus', 'Ulaştırma'], ['TAVHL', 'TAV Havalimanları', 'Ulaştırma'],
  ['ASELS', 'Aselsan', 'Savunma'], ['OTKAR', 'Otokar', 'Savunma'],
  ['GARAN', 'Garanti BBVA', 'Banka'], ['AKBNK', 'Akbank', 'Banka'], ['YKBNK', 'Yapı Kredi', 'Banka'],
  ['ISCTR', 'İş Bankası (C)', 'Banka'], ['HALKB', 'Halkbank', 'Banka'], ['VAKBN', 'Vakıfbank', 'Banka'], ['TSKB', 'TSKB', 'Banka'],
  ['KCHOL', 'Koç Holding', 'Holding'], ['SAHOL', 'Sabancı Holding', 'Holding'], ['ALARK', 'Alarko Holding', 'Holding'],
  ['DOHOL', 'Doğan Holding', 'Holding'], ['AGHOL', 'AG Anadolu Grubu', 'Holding'], ['TKFEN', 'Tekfen Holding', 'Holding'],
  ['EREGL', 'Ereğli Demir Çelik', 'Metal'], ['KRDMD', 'Kardemir (D)', 'Metal'], ['BRSAN', 'Borusan Boru', 'Metal'], ['KCAER', 'Kocaer Çelik', 'Metal'],
  ['TUPRS', 'Tüpraş', 'Enerji'], ['ENJSA', 'Enerjisa', 'Enerji'], ['AKSEN', 'Aksa Enerji', 'Enerji'], ['ASTOR', 'Astor Enerji', 'Enerji'],
  ['EUPWR', 'Europower Enerji', 'Enerji'], ['CWENE', 'CW Enerji', 'Enerji'], ['SMRTG', 'Smart Güneş', 'Enerji'], ['GESAN', 'Girişim Elektrik', 'Enerji'],
  ['PETKM', 'Petkim', 'Kimya'], ['SASA', 'Sasa Polyester', 'Kimya'], ['HEKTS', 'Hektaş', 'Kimya'], ['GUBRF', 'Gübre Fabrikaları', 'Kimya'],
  ['SISE', 'Şişecam', 'Cam'], ['OYAKC', 'Oyak Çimento', 'Çimento'], ['CIMSA', 'Çimsa', 'Çimento'],
  ['BIMAS', 'BİM', 'Perakende'], ['MGROS', 'Migros', 'Perakende'], ['SOKM', 'Şok Marketler', 'Perakende'], ['MAVI', 'Mavi Giyim', 'Perakende'],
  ['FROTO', 'Ford Otosan', 'Otomotiv'], ['TOASO', 'Tofaş', 'Otomotiv'], ['DOAS', 'Doğuş Otomotiv', 'Otomotiv'], ['TTRAK', 'Türk Traktör', 'Otomotiv'],
  ['TCELL', 'Turkcell', 'Telekom'], ['TTKOM', 'Türk Telekom', 'Telekom'],
  ['ARCLK', 'Arçelik', 'Dayanıklı Tüketim'], ['VESTL', 'Vestel', 'Dayanıklı Tüketim'],
  ['ULKER', 'Ülker', 'Gıda'], ['AEFES', 'Anadolu Efes', 'İçecek'], ['CCOLA', 'Coca-Cola İçecek', 'İçecek'],
  ['EKGYO', 'Emlak Konut GYO', 'GYO'], ['ENKAI', 'Enka İnşaat', 'İnşaat'],
  ['KONTR', 'Kontrolmatik', 'Teknoloji'], ['MIATK', 'Mia Teknoloji', 'Teknoloji'], ['ISMEN', 'İş Yatırım', 'Aracı Kurum'],
]

const EMTIA: [string, string, Currency][] = [
  ['GC=F', 'Ons Altın', 'USD'], ['SI=F', 'Ons Gümüş', 'USD'], ['BZ=F', 'Brent Petrol', 'USD'], ['CL=F', 'WTI Petrol', 'USD'],
  ['NG=F', 'Doğalgaz', 'USD'], ['HG=F', 'Bakır', 'USD'], ['USDTRY=X', 'Dolar/TL', 'TRY'], ['EURTRY=X', 'Euro/TL', 'TRY'],
]

export interface SyntheticDef {
  a: string
  b: string
  op: 'mul' | 'div'
  k: number
}

const OZ = 31.1034768

export const SYNTHETIC: Record<string, SyntheticDef> = {
  GAUTRY: { a: 'GC=F', b: 'USDTRY=X', op: 'mul', k: OZ },
  XAGTRY: { a: 'SI=F', b: 'USDTRY=X', op: 'mul', k: OZ },
  XU100USD: { a: 'XU100.IS', b: 'USDTRY=X', op: 'div', k: 1 },
}

const SENTETIK: [string, string, Currency][] = [
  ['GAUTRY', 'Gram Altın (TL)', 'TRY'], ['XAGTRY', 'Gram Gümüş (TL)', 'TRY'], ['XU100USD', 'BIST 100 (USD)', 'USD'],
]

const KRIPTO = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'AVAXUSDT', 'DOGEUSDT', 'BTCTRY', 'USDTTRY']

const mk = (symbol: string, name: string, category: Category, source: Source, currency: Currency, sector?: string): SymbolInfo =>
  ({ symbol, name, category, source, currency, sector })

export const SYMBOLS: SymbolInfo[] = [
  ...BIST.map(([c, n, s]) => mk(`${c}.IS`, n, 'BIST', 'yahoo', 'TRY', s)),
  ...EMTIA.map(([c, n, cur]) => mk(c, n, 'EMTIA', 'yahoo', cur)),
  ...SENTETIK.map(([c, n, cur]) => mk(c, n, 'SENTETIK', 'synthetic', cur)),
  ...KRIPTO.map((c) => mk(c, c.replace(/(USDT|TRY)$/, '/$1'), 'KRIPTO', 'binance', c.endsWith('TRY') ? 'TRY' : 'USDT')),
]

const BY_SYMBOL = new Map(SYMBOLS.map((s) => [s.symbol, s]))

export const getSymbol = (symbol: string): SymbolInfo =>
  BY_SYMBOL.get(symbol) ?? mk(symbol, symbol, 'BIST', 'yahoo', 'TRY')

export const CATEGORIES: { key: Category | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tümü' }, { key: 'BIST', label: 'BIST' }, { key: 'EMTIA', label: 'Emtia' },
  { key: 'SENTETIK', label: 'Sentetik' }, { key: 'KRIPTO', label: 'Kripto' },
]

export const displayName = (symbol: string) => symbol.replace(/\.IS$/, '')
