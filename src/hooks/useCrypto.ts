import { useEffect } from 'react'
import { create } from 'zustand'
import { BinanceAdapter, type Ticker } from '../adapters/BinanceAdapter'
import { registerCrypto } from '../data/symbols'
import { useApp } from '../store/app'

export const useTickers = create<{ tickers: Record<string, Ticker> }>()(() => ({ tickers: {} }))

/** Binance paritelerini periyodik olarak çeker; arama, kripto listeleri ve tarama bu veriyi kullanır. */
export function useCryptoUniverse() {
  useEffect(() => {
    const run = () =>
      BinanceAdapter.allTickers().then((tickers) => {
        useTickers.setState({ tickers })
        const count = registerCrypto(Object.keys(tickers).filter((s) => tickers[s].volume > 0))
        if (useApp.getState().cryptoCount !== count) useApp.getState().set({ cryptoCount: count })
      }, () => undefined)
    run()
    const id = setInterval(run, 30_000)
    return () => clearInterval(id)
  }, [])
}
