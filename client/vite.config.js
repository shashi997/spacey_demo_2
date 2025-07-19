import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  optimizeDeps: {
    exclude: ['face-api.js']
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      'fs': false,
      'path': false,
      'os': false,
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
