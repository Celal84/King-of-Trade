// Cloudflare Worker: Yahoo Finance CORS proxy. Kullanım: https://<worker>.workers.dev/?url=<encoded yahoo url>
const ALLOWED = /^https:\/\/(query1|query2)\.finance\.yahoo\.com\//
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const target = new URL(request.url).searchParams.get('url')
    if (!target || !ALLOWED.test(target)) return new Response('Invalid url', { status: 400, headers: CORS })
    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      cf: { cacheTtl: 30, cacheEverything: true },
    })
    const headers = new Headers(CORS)
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json')
    headers.set('Cache-Control', 'public, max-age=30')
    return new Response(upstream.body, { status: upstream.status, headers })
  },
}
