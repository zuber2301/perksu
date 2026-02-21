import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // When running in Docker, we need to tell Vite that the client 
    // will be connecting via the host port (7173).
    hmr: {
      clientPort: 7173,
    },
    // Required for Docker on some systems to detect file changes
    watch: {
      usePolling: true,
    },
    // API Proxying
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
