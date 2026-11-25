import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-3 pt-[max(12px,env(safe-area-inset-top))]" onClick={onClose}>
      <div className="w-full max-w-md max-h-[85vh] flex flex-col bg-panel border border-line rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 h-10 border-b border-line">
          <span className="text-sm font-semibold">{title}</span>
          <button className="btn" onClick={onClose} aria-label="Kapat"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-3">{children}</div>
      </div>
    </div>
  )
}
