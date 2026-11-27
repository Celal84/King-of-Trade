import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { useAlerts } from '../store/alerts'
import { usePortfolio } from '../store/portfolio'
import { marketOpen } from '../lib/market'

// Açık piyasadaki semboller 5 saniyede bir, kapalı olanlar dakikada bir yenilenir
const INTERVAL = 5_000
const IDLE_EVERY = 12

function tracked(): string[] {
  const a = useApp.getState()
  const p = usePaper.getState()
  return [
    ...a.watchSymbols, ...a.panes, ...Object.keys(p.positions), ...p.orders.map((o) => o.symbol),
    ...usePortfolio.getState().txs.map((t) => t.symbol), 'USDTRY=X',
    ...useAlerts.getState().alerts.filter((x) => x.active).map((x) => x.symbol),
  ]
}

export function usePriceFeed() {
  const watch = useApp((s) => s.watchSymbols)
  useEffect(() => {
    let alive = true
    let tick = 0
    const run = () => {
      if (document.hidden) return
      const all = tick++ % IDLE_EVERY === 0
      const symbols = [...new Set(tracked())].filter((s) => all || marketOpen(s))
      if (!symbols.length) return
      MarketRouter.streamQuotes(symbols, (q) => {
        if (!alive) return
        useApp.getState().setPrices(q)
        usePaper.getState().check(useApp.getState().prices)
      })
    }
    run()
    const id = setInterval(run, INTERVAL)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [watch])
}
