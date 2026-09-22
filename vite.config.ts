import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas mudam raramente: em chunks próprios, continuam no cache
        // do navegador quando um deploy altera só o código do app.
        manualChunks(id) {
          const pkg = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1];
          if (!pkg) return undefined;
          if (['react', 'react-dom', 'scheduler'].includes(pkg)) return 'react';
          if (['leaflet', 'react-leaflet', '@react-leaflet'].some((name) => pkg.startsWith(name)))
            return 'map';
          if (pkg.startsWith('@tanstack')) return 'query';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
