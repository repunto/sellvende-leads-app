import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    strictPort: true,
    open: false,
    hmr: {
      overlay: false,   // Don't crash the overlay on syntax errors
    },
    watch: {
      usePolling: true,  // More reliable file watching on Windows
      interval: 1000,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  // Prevent Vite from crashing on dependency optimization errors
  optimizeDeps: {
    exclude: [],
  },
})
