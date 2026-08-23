import axios from 'axios'

// Prefer relative (same-origin) requests by default to avoid accidental
// calls to an external host set at build-time. If `VITE_API_URL` is explicitly
// provided (non-empty), use it; otherwise use a relative base so the browser
// sends requests to the same origin that served the frontend.
const envApi = import.meta.env.VITE_API_URL
export const apiBaseUrl = (typeof envApi === 'string' && envApi.length > 0)
  ? envApi.replace(/\/api\/?$/, '')
  : ''

axios.defaults.baseURL = apiBaseUrl
axios.defaults.withCredentials = false

// Default avatar as inline SVG data URL (avoids file serving issues on Vercel)
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMDAgMjAwIj4KICAKICAGPHJLY3Qgc3R5bGU9ImZpbGw6ICNlNWU3ZWI7IiB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIvPgogIDxjaXJjbGUgc3R5bGU9ImZpbGw6ICM5Y2EzYWY7IiBjeD0iMTAwIiBjeT0iNzAiIHI9IjM1Ii8+CiAgPHBhdGggc3R5bGU9ImZpbGw6ICM5Y2EzYWY7IiBkPSJNIDUwIDE1MCBRIDUwIDEyMCAxMDAgMTIwIFEgMTUwIDEyMCAxNTAgMTUwIEwgMTUwIDIwMCBMIDUwIDIwMCBaIi8+Cjwvc3ZnPg=='

export const resolveImageUrl = (url) => {
  if (!url || (typeof url === 'string' && url.trim().length === 0)) return DEFAULT_AVATAR
  if (typeof url === 'string') {
    const normalized = url.startsWith('uploads/') ? `/${url}` : url
    if (normalized.startsWith('/uploads/')) {
      return `${apiBaseUrl}${normalized}`
    }
    return normalized
  }
  return DEFAULT_AVATAR
}

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => Promise.reject(error))

export default axios
