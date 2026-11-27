import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { disclosureUrl, getDisclosures, type Disclosure } from '../lib/company'

/** Şirketin son 180 gündeki KAP bildirimleri; satıra dokununca bildirim KAP'ta açılır. */
export default function KapNews({ symbol }: { symbol: string }) {
  const [list, setList] = useState<Disclosure[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let alive = true
    setList(null)
    setErr(false)
    getDisclosures(symbol).then((d) => alive && setList(d), () => alive && setErr(true))
    return () => {
      alive = false
    }
  }, [symbol])
  if (err) return <p className="p-3 text-xs text-down">KAP bildirimleri alınamadı.</p>
  if (!list) return <p className="p-3 text-xs text-mute">Yükleniyor…</p>
  if (!list.length) return <p className="p-3 text-xs text-mute">Son 180 günde bildirim yok.</p>
  return (
    <ul className="divide-y divide-line text-xs">
      {list.map((d) => (
        <li key={d.index}>
          <a className="block px-2 py-1.5 hover:bg-line/50" href={disclosureUrl(d.index)} target="_blank" rel="noreferrer">
            <div className="flex items-center gap-1 text-[10px] text-mute"><span>{d.date.slice(0, 16)}</span><span className="truncate flex-1">· {d.from}</span><ExternalLink size={10} /></div>
            <div className="font-semibold">{d.subject}</div>
            {d.summary && d.summary !== d.subject && <div className="text-mute line-clamp-2">{d.summary}</div>}
          </a>
        </li>
      ))}
      <li className="p-2 text-[10px] text-mute">Kaynak: Kamuyu Aydınlatma Platformu (kap.org.tr)</li>
    </ul>
  )
}
