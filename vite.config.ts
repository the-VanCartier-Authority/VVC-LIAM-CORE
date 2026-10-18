import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifestFilename: 'manifest.json',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'offline.html',
          'screenshot-desktop.png',
          'screenshot-mobile.png',
        ],
        manifest: {
          id: '/',
          name: 'VVC LIAM CORE',
          short_name: 'LIAM CORE',
          description: 'Control // Analyze // Execute. Orquestador de agentes autónomos, telemetría y arquitectura multiplataforma.',
          lang: 'es',
          dir: 'ltr',
          theme_color: '#0A060D',
          background_color: '#0A060D',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['productivity', 'utilities', 'business'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
          screenshots: [
            {
              src: '/screenshot-desktop.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide',
              label: 'VVC LIAM CORE - Consola Principal',
            },
            {
              src: '/screenshot-mobile.png',
              sizes: '750x1334',
              type: 'image/png',
              form_factor: 'narrow',
              label: 'VVC LIAM CORE - Interfaz Móvil',
            },
          ],
          shortcuts: [
            {
              name: 'Consola de Comandos',
              short_name: 'Consola',
              description: 'Abrir la consola interactiva de voz y texto',
              url: '/?mode=console',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Agentes Especializados',
              short_name: 'Agentes',
              description: 'Bifurcación de agentes Vladimir, Valentina y Victoria',
              url: '/?mode=agents',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Telemetría VAOS',
              short_name: 'Telemetría',
              description: 'Monitor de rendimiento y métricas operativas',
              url: '/?mode=telemetry',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
            {
              name: 'Centro de Ayuda',
              short_name: 'Ayuda',
              description: 'Manual operativo, atajos de voz y preguntas frecuentes',
              url: '/?mode=help',
              icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
            },
          ],
          note_taking: {
            new_note_url: '/?action=new-note',
          },
          scope_extensions: [
            {
              origin: 'https://ais-pre-fiyohvu2y7dcecb5bhit2f-877308304198.us-east1.run.app',
            },
          ],
        } as any,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          navigateFallback: '/offline.html',
          importScripts: ['/sw-push.js'],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
