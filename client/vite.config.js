import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '172.20.10.7',
    port: 5173,
    proxy: {
      '/resend-verification': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/verify-email': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/discover': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/matches': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/likes': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/messages': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/me': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/logout': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/user': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
