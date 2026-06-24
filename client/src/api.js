import axios from 'axios'

const runtimeHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'localhost'
  : window.location.hostname

export const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${runtimeHost}:3001`

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
