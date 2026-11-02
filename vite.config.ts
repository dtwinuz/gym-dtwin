import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { IMAGE_CACHE, NAV_DENYLIST, PRECACHE_IGNORE, isApi, isExerciseImage, isFontCss, isFontFile } from './src/pwa/routes.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'gym.dtwin',
        short_name: 'gym.dtwin',
        description: 'Mashg\'ulot kundaligi: reja, set yozish, dam olish taymeri, rekordlar va progress.',
        lang: 'uz',
        dir: 'ltr',
        start_url: '/#/home',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f1012',
        background_color: '#0f1012',
        categories: ['health', 'fitness', 'sports'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: PRECACHE_IGNORE,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: NAV_DENYLIST,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { urlPattern: isApi, handler: 'NetworkOnly' },
          {
            urlPattern: isExerciseImage,
            handler: 'CacheFirst',
            options: {
              cacheName: IMAGE_CACHE.name,
              expiration: { maxEntries: IMAGE_CACHE.maxEntries, maxAgeSeconds: IMAGE_CACHE.maxAgeSeconds, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          { urlPattern: isFontCss, handler: 'StaleWhileRevalidate', options: { cacheName: 'gym-font-css', expiration: { maxEntries: 4 } } },
          {
            urlPattern: isFontFile,
            handler: 'CacheFirst',
            options: { cacheName: 'gym-font-files', expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 800 },
})
