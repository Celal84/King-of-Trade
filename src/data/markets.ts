export type Cur = 'TRY' | 'USD' | 'USDT'

export const INDICES: [string, string][] = [
  ['XU100', 'BIST 100'], ['XU050', 'BIST 50'], ['XU030', 'BIST 30'], ['XUTUM', 'BIST Tüm'], ['XYLDZ', 'BIST Yıldız'],
  ['XBANK', 'BIST Banka'], ['XUSIN', 'BIST Sınai'], ['XUHIZ', 'BIST Hizmetler'], ['XUMAL', 'BIST Mali'], ['XUTEK', 'BIST Teknoloji'],
  ['XHOLD', 'BIST Holding ve Yatırım'], ['XGMYO', 'BIST Gayrimenkul Y.O.'], ['XKTUM', 'BIST Katılım Tüm'], ['XK100', 'BIST Katılım 100'],
  ['XK030', 'BIST Katılım 30'], ['XELKT', 'BIST Elektrik'], ['XGIDA', 'BIST Gıda İçecek'], ['XKMYA', 'BIST Kimya Petrol Plastik'],
  ['XMANA', 'BIST Metal Ana'], ['XMESY', 'BIST Metal Eşya Makina'], ['XMADN', 'BIST Madencilik'], ['XTRZM', 'BIST Turizm'],
  ['XULAS', 'BIST Ulaştırma'], ['XILTM', 'BIST İletişim'], ['XINSA', 'BIST İnşaat'], ['XSGRT', 'BIST Sigorta'], ['XTEKS', 'BIST Tekstil Deri'],
  ['XTCRT', 'BIST Ticaret'], ['XBLSM', 'BIST Bilişim'], ['XSPOR', 'BIST Spor'], ['XTAST', 'BIST Taş Toprak'], ['XKAGT', 'BIST Orman Kağıt Basım'],
  ['XUSRD', 'BIST Sürdürülebilirlik'], ['XTMTU', 'BIST Temettü'],
]

export const EMTIA: [string, string, Cur][] = [
  ['GC=F', 'Ons Altın', 'USD'], ['SI=F', 'Ons Gümüş', 'USD'], ['PL=F', 'Platin', 'USD'], ['PA=F', 'Paladyum', 'USD'],
  ['BZ=F', 'Brent Petrol', 'USD'], ['CL=F', 'WTI Petrol', 'USD'], ['NG=F', 'Doğalgaz', 'USD'], ['HG=F', 'Bakır', 'USD'],
  ['ZW=F', 'Buğday', 'USD'], ['ZC=F', 'Mısır', 'USD'], ['KC=F', 'Kahve', 'USD'], ['CT=F', 'Pamuk', 'USD'],
  ['USDTRY=X', 'Dolar/TL', 'TRY'], ['EURTRY=X', 'Euro/TL', 'TRY'], ['GBPTRY=X', 'Sterlin/TL', 'TRY'], ['EURUSD=X', 'Euro/Dolar', 'USD'],
  ['DX-Y.NYB', 'Dolar Endeksi (DXY)', 'USD'], ['^GSPC', 'S&P 500', 'USD'], ['^IXIC', 'Nasdaq', 'USD'], ['^GDAXI', 'DAX', 'USD'],
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
  XU100EUR: { a: 'XU100.IS', b: 'EURTRY=X', op: 'div', k: 1 },
  BRENTTRY: { a: 'BZ=F', b: 'USDTRY=X', op: 'mul', k: 1 },
}

export const SENTETIK: [string, string, Cur][] = [
  ['GAUTRY', 'Gram Altın (TL)', 'TRY'], ['XAGTRY', 'Gram Gümüş (TL)', 'TRY'], ['XU100USD', 'BIST 100 (USD)', 'USD'],
  ['XU100EUR', 'BIST 100 (EUR)', 'USD'], ['BRENTTRY', 'Brent Petrol (TL)', 'TRY'],
]

export const KRIPTO = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'PAXGUSDT', 'BTCTRY', 'ETHTRY', 'USDTTRY']
