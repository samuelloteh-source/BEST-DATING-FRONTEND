import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const BACKEND_TARGET = 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/resend-verification': { target: BACKEND_TARGET, changeOrigin: true },
      '/verify-email': { target: BACKEND_TARGET, changeOrigin: true },
      '/verify/face': { target: BACKEND_TARGET, changeOrigin: true },
      '/discover': { target: BACKEND_TARGET, changeOrigin: true },
      '/matches': { target: BACKEND_TARGET, changeOrigin: true },
      '/likes': { target: BACKEND_TARGET, changeOrigin: true },
      '/messages': { target: BACKEND_TARGET, changeOrigin: true },
      '/notifications': { target: BACKEND_TARGET, changeOrigin: true },
      '/me': { target: BACKEND_TARGET, changeOrigin: true },
      '/logout': { target: BACKEND_TARGET, changeOrigin: true },
      '/api/user': { target: BACKEND_TARGET, changeOrigin: true },
      '/login': { target: BACKEND_TARGET, changeOrigin: true },
      '/signup': { target: BACKEND_TARGET, changeOrigin: true },
      '/discover/like': { target: BACKEND_TARGET, changeOrigin: true },
      '/discover/pass': { target: BACKEND_TARGET, changeOrigin: true },
      '/discover/superlike': { target: BACKEND_TARGET, changeOrigin: true },
      '/profile/gallery': { target: BACKEND_TARGET, changeOrigin: true },
    },
  },
})
