import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': env.VITE_DEV_API_PROXY || 'http://localhost:8000',
        '/ws': {
          target: env.VITE_DEV_WS_PROXY || 'ws://localhost:8000',
          ws: true,
        },
      },
    },
  }
})
