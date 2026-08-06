import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'favicon-48x48.png', 'logo.png', 'robots.txt', 'apple-touch-icon.png', 'sitemap.xml', 'offline.html', 'icons/icon-*.png'],
      manifest: {
        name: 'Fiesta y Lista',
        short_name: 'FiestaL',
        description: 'Crea y comparte listas de regalos para tus eventos especiales',
        theme_color: '#ec4899',
        background_color: '#fdf2f8',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['events', 'lifestyle', 'social'],
        lang: 'es-CO',
        dir: 'ltr',
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webp}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // A3: whitelist de endpoints PÚBLICOS por diseño (página pública
            // por slug, regalos/fotos/mensajes de invitado). Antes se cacheaban
            // también los GETs autenticados (/api/events, /api/events/:id,
            // /api/account, /api/stats...) en la caché compartida del origen:
            // el siguiente usuario del dispositivo veía los datos del anterior.
            // B1: NetworkFirst SOLO sirve caché si la red falla (timeout 5s),
            // pero el estado de regalos (disponible/apartado) se acota a 10 min
            // para no ofrecer un regalo ya apartado en modo offline.
            urlPattern: /^https?:\/\/.*\/api\/events\/(slug\/[^/?#]+|[^/?#]+\/(gifts|photos|messages))([?#].*)?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 10 * 60 },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          animations: ['framer-motion'],
        },
      },
    },
  },
});
