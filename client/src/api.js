import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.host}`

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
