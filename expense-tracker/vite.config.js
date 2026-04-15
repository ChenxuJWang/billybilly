import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['xlsx', 'js-yaml', 'pdfjs-dist/build/pdf.mjs'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,           // listen on all network interfaces (0.0.0.0)
    port: 5173,           // dev server port
    strictPort: true,     // fail if 5173 is already in use
    allowedHosts: [       // allow CASA host header
      'casaos.local'
    ],
    hmr: {
      host: 'casaos.local',
      port: 5173,
    },
  },
})
