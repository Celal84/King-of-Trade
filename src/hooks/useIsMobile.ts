import { useEffect, useState } from 'react'

/** Yatay tutulan telefon: geniş ama kısa ekran. */
export const LANDSCAPE_PHONE = '(max-height: 520px) and (max-width: 1024px)'
/** Telefon düzeni: dar ekran veya yatay tutulan telefon. */
export const MOBILE = `(max-width: 767px), ${LANDSCAPE_PHONE}`

function useMedia(query: string) {
  const [m, setM] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const h = () => setM(mq.matches)
    h()
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [query])
  return m
}

export const useIsMobile = () => useMedia(MOBILE)
export const useIsLandscapePhone = () => useMedia(LANDSCAPE_PHONE)
