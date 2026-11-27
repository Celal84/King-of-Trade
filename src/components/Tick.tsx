import { useEffect, useRef, type ReactNode } from 'react'

/** Değer değiştiğinde yönüne göre kısa bir yeşil/kırmızı parlama gösterir. */
export default function Tick({ value, className = '', children }: { value: number | undefined; className?: string; children: ReactNode }) {
  const prev = useRef(value)
  const dir = value !== undefined && prev.current !== undefined && value !== prev.current ? (value > prev.current ? 'flash-up' : 'flash-down') : ''
  useEffect(() => {
    prev.current = value
  })
  return <span key={String(value)} className={`${className} ${dir}`}>{children}</span>
}
