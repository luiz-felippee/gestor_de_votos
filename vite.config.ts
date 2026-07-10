/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/tests/**'],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Gestor de Votos',
        short_name: 'Gestor Votos',
        description: 'Plataforma Premium de Gestão de Campanhas',
        theme_color: '#4f46e5',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Limita o tamanho máximo do precache para não travar em dados móveis
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
        runtimeCaching: [
          // ---- Fotos das lideranças → CacheFirst (imagens, mudam raramente) ----
          {
            urlPattern: /\/api\/cabos\/[^/]+\/foto$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cabo-fotos-cache',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          // ---- API calls → NetworkFirst com fallback cache ----
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 30, // 30 min
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 8, // Em 3G lento, usa cache após 8s
            },
          },
          // ---- Tiles do mapa (CARTO CDN) → StaleWhileRevalidate ----
          // StaleWhileRevalidate + cache só de 200: serve rápido do cache mas
          // sempre revalida em segundo plano, então nunca fica "preso" num tile
          // quebrado. Nome novo (v2) abandona o cache antigo que podia estar
          // envenenado com respostas vazias (status 0).
          {
            urlPattern: /^https:\/\/([a-d]\.basemaps\.cartocdn\.com|[a-c]\.tile\.openstreetmap\.org)\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-tiles-cache-v2',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          // ---- Mapa local (Topo/GeoJSON) → CacheFirst ----
          {
            urlPattern: /\/pe-municipios\.(topo|geo)json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geojson-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 dias
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // ---- Google Fonts CSS → StaleWhileRevalidate ----
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // ---- Google Fonts woff2 → CacheFirst (imutáveis) ----
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // ---- Imagens CDN (avatares, etc.) → CacheFirst ----
          {
            urlPattern: /^https:\/\/(ui-avatars\.com|cdn-icons-png\.flaticon\.com)\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'external-images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router-dom/')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/leaflet/') || id.includes('node_modules/react-leaflet/')) {
            return 'map-vendor'
          }
          if (id.includes('node_modules/recharts/')) {
            return 'chart-vendor'
          }
        },
      },
    },
  },
})
