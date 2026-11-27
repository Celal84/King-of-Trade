import { useEffect } from 'react'
import { create } from 'zustand'
import { BinanceAdapter, type Ticker } from '../adapters/BinanceAdapter'
import { registerCrypto } from '../data/symbols'
import { useApp } from '../store/app'

const MINI_TICKER = 'wss://stream.binance.com:9443/ws/!miniTicker@arr'

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
    // Canlı akış: tüm paritelerin fiyatı saniyede bir güncellenir; akış açılamazsa yukarıdaki yoklama yeterli olur
    let ws: WebSocket | null = null
    let closed = false
    let retry: ReturnType<typeof setTimeout>
    const open = () => {
      ws = new WebSocket(MINI_TICKER)
      ws.onmessage = (e) => {
        if (document.hidden) return
        const patch: Record<string, Ticker> = {}
        for (const t of JSON.parse(e.data as string) as { s: string; c: string; o: string; q: string }[]) patch[t.s] = { price: +t.c, change: +t.o ? (+t.c / +t.o - 1) * 100 : 0, volume: +t.q }
        useTickers.setState((st) => ({ tickers: { ...st.tickers, ...patch } }))
      }
      ws.onclose = () => {
        if (!closed) retry = setTimeout(open, 10_000)
      }
    }
    open()
    return () => {
      closed = true
      clearInterval(id)
      clearTimeout(retry)
      ws?.close()
    }
  }, [])
}
