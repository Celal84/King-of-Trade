import { useEffect } from 'react'
import { MarketRouter } from '../adapters/MarketRouter'
import { useApp } from '../store/app'
import { usePaper } from '../store/paper'
import { useAlerts } from '../store/alerts'

const INTERVAL = 20_000

function tracked(): string[] {
  const a = useApp.getState()
  const p = usePaper.getState()
  return [
    ...a.watchSymbols, ...a.panes, ...Object.keys(p.positions), ...p.orders.map((o) => o.symbol),
    ...useAlerts.getState().alerts.filter((x) => x.active).map((x) => x.symbol),
  ]
}

export function usePriceFeed() {
  const watch = useApp((s) => s.watchSymbols)
  useEffect(() => {
    let alive = true
    const run = async () => {
      const q = await MarketRouter.getQuotes(tracked())
      if (!alive) return
      useApp.getState().setPrices(q)
      usePaper.getState().check(useApp.getState().prices)
    }
    run()
    const id = setInterval(run, INTERVAL)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [watch])
}
