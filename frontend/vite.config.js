import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/crm/',
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
    proxy: {
      '/crm/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/crm\/api/, '/api'),
      },
    },
  },
})