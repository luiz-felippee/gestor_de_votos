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
      // 'prompt' (era 'autoUpdate'): a versão nova só assume quando o usuário aceita
      // o toast — o reload automático derrubava quem estava no meio de um cadastro.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon-180.png'],
      manifest: {
        id: '/',
        lang: 'pt-BR',
        dir: 'ltr',
        name: 'Gestor de Votos',
        short_name: 'Gestor Votos',
        description: 'Plataforma Premium de Gestão de Campanhas',
        theme_color: '#4f46e5',
        // Cor da marca: é o fundo do SPLASH nativo (Android monta a tela de abertura
        // do app instalado com background_color + ícone). Antes era cinza claro e a
        // abertura não parecia o app.
        background_color: '#4f46e5',
        display: 'standalone',
        // Sem trava de orientação: a planilha e o mapa ficam bem melhores em paisagem.
        start_url: '/',
        scope: '/',
        categories: ['business', 'productivity'],
        // Escada completa de tamanhos: cada dispositivo/densidade de tela escolhe o
        // mais próximo pelo atributo sizes (launcher Android, atalhos, install prompt,
        // splash). Gerados a partir do icon-512 (scripts em PowerShell/System.Drawing).
        icons: [
          ...[64, 96, 128, 144, 192, 256, 384, 512].map((s) => ({
            src: `/icon-${s}.png`,
            sizes: `${s}x${s}`,
            type: 'image/png',
          })),
          // 'maskable' separado do 'any' e com arquivo próprio: fundo cheio na cor da
          // marca + ícone a 80% (zona segura) — o recorte redondo do Android não corta nada.
          {
            src: '/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        // Atalhos do ícone (toque longo no Android / botão direito no desktop)
        shortcuts: [
          {
            name: 'Painel',
            url: '/',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Eleitores',
            url: '/planilha',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Lideranças',
            url: '/cabos',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // A Logo pede /icon-192.png?v=3 (cache-busting). O precache guarda /icon-192.png
        // sem query — sem esta regra o ?v= vira cache miss e a logo quebra offline.
        ignoreURLParametersMatching: [/^v$/, /^utm_/, /^fbclid$/],
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
          // /api/auth fica FORA do cache de propósito: são dados de sessão (login, /me).
          // Cachear isso significa que, num aparelho compartilhado, o usuário seguinte
          // poderia receber offline a sessão/identidade do anterior.
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'),
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
          // Só o react-vendor tem regra aqui, e é de propósito.
          //
          // Antes havia também 'chart-vendor' (recharts) e 'map-vendor' (leaflet). O efeito
          // era o oposto do pretendido: o chunk manual vira um vendor compartilhado que entra
          // no modulepreload do index.html, então a TELA DE LOGIN baixava 364 KB de gráficos
          // (e depois 180 KB de mapa) que ela nunca usa — mesmo com as páginas já sendo lazy.
          // Sem essas regras, recharts e leaflet ficam dentro dos chunks lazy que os usam e só
          // descem quando o usuário abre o dashboard ou o mapa.
        },
      },
    },
  },
})
