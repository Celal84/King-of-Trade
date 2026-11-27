import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { isSection, useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { useAlerts } from '../store/alerts'
import { usePortfolio } from '../store/portfolio'
import { marketOpen } from '../lib/market'

// Listelerim, portföy ve açık grafiklerdeki semboller 2 saniyede bir; izlenen diğer semboller 6 saniyede bir;
// piyasası kapalı olanlar dakikada bir yenilenir.
const INTERVAL = 2_000
const OTHERS_EVERY = 3
const IDLE_EVERY = 30
const FX = 'USDTRY=X'

/** Sık yenilenecek semboller: kendi listelerim, portföyüm ve ekrandaki grafikler. */
function priority(): Set<string> {
  const a = useApp.getState()
  return new Set([...a.lists.flatMap((l) => l.symbols.filter((s) => !isSection(s))), ...a.panes, ...usePortfolio.getState().txs.map((t) => t.symbol), FX])
}

function tracked(): string[] {
  const a = useApp.getState()
  const p = usePaper.getState()
  return [
    ...a.watchSymbols, ...Object.keys(p.positions), ...p.orders.map((o) => o.symbol),
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
      const [idle, others] = [tick % IDLE_EVERY === 0, tick % OTHERS_EVERY === 0]
      tick++
      const fast = priority()
      const symbols = [...new Set([...fast, ...tracked()])].filter((s) => idle || (marketOpen(s) && (others || fast.has(s))))
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
