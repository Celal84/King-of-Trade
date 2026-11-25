import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'King of Trade',
        short_name: 'KingOfTrade',
        description: 'BIST 100, Emtia, Sentetik TR ve Kripto finansal terminal',
        theme_color: '#131722',
        background_color: '#131722',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'], maximumFileSizeToCacheInBytes: 4_000_000 },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
})
