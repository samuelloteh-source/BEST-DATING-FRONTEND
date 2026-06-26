import axios from 'axios'

// Prefer relative (same-origin) requests by default to avoid accidental
// calls to an external host set at build-time. If `VITE_API_URL` is explicitly
// provided (non-empty), use it; otherwise use a relative base so the browser
// sends requests to the same origin that served the frontend.
const envApi = import.meta.env.VITE_API_URL
export const apiBaseUrl = (typeof envApi === 'string' && envApi.length > 0) ? envApi : ''

axios.defaults.baseURL = apiBaseUrl
axios.defaults.withCredentials = false

export const resolveImageUrl = (url) => {
  if (!url) return ''
  if (typeof url === 'string' && url.startsWith('/uploads/')) {
    return `${apiBaseUrl}${url}`
  }
  return url
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
