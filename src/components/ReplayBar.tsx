import { useEffect } from 'react'
import { Pause, Play, StepForward, X } from 'lucide-react'
import { useReplay } from '../store/replay'

const SPEEDS = [1, 2, 5] as const

export default function ReplayBar() {
  const r = useReplay()
  useEffect(() => {
    if (!r.playing) return
    const id = setInterval(() => {
      const s = useReplay.getState()
      if (s.cursor >= s.length - 1) s.set({ playing: false })
      else s.set({ cursor: s.cursor + 1 })
    }, 1000 / r.speed)
    return () => clearInterval(id)
  }, [r.playing, r.speed])
  const ensureStart = () => r.cursor < 0 && r.set({ cursor: Math.max(0, r.length - 100), selecting: false })
  const step = () => (r.cursor < 0 ? ensureStart() : r.cursor < r.length - 1 && r.set({ cursor: r.cursor + 1 }))
  return (
    <div className="flex items-center gap-1 h-9 px-2 bg-[#2a2210] border-b border-yellow-700/40 text-xs overflow-x-auto no-scrollbar shrink-0">
      <span className="text-yellow-400 font-semibold mr-1 whitespace-nowrap">Bar Replay</span>
      {r.selecting ? <span className="text-mute whitespace-nowrap">Başlangıç mumuna tıklayın veya Oynat'a basın</span> : <span className="text-mute">{r.cursor + 1}/{r.length}</span>}
      <button className="btn" onClick={() => (ensureStart(), r.set({ playing: !r.playing, selecting: false }))}>{r.playing ? <Pause size={14} /> : <Play size={14} />}</button>
      <button className="btn" onClick={step} title="1 mum ileri"><StepForward size={14} /></button>
      {SPEEDS.map((s) => (
        <button key={s} className={`btn ${r.speed === s ? 'btn-on' : ''}`} onClick={() => r.set({ speed: s })}>{s}x</button>
      ))}
      <button className="btn ml-auto" onClick={() => r.set({ active: false, playing: false, selecting: false, cursor: -1 })}><X size={14} /> Çık</button>
    </div>
  )
}
