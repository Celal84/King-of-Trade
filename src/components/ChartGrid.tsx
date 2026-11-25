import { useEffect } from 'react'
import ChartPane from './ChartPane'
import { useApp } from '../store/app'

const GRID = {
  '1x1': ['grid-cols-1 grid-rows-1', 1], '1x2': ['grid-cols-2 grid-rows-1', 2], '1x3': ['grid-cols-3 grid-rows-1', 3],
  '2x2': ['grid-cols-2 grid-rows-2', 4], '2x3': ['grid-cols-3 grid-rows-2', 6],
} as const

export default function ChartGrid({ mobile }: { mobile: boolean }) {
  const layout = useApp((s) => (mobile ? '1x1' : s.layout))
  const active = useApp((s) => s.active)
  const [cls, n] = GRID[layout]
  useEffect(() => {
    if (n > 1 && active >= n) useApp.getState().setActive(0)
  }, [n, active])
  const indexes = n === 1 ? [active] : Array.from({ length: n }, (_, i) => i)
  return (
    <main className={`grid ${cls} flex-1 min-w-0 min-h-0 gap-px bg-line`}>
      {indexes.map((i) => <ChartPane key={i} index={i} />)}
    </main>
  )
}
