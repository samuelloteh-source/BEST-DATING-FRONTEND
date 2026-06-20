import axios from 'axios'

const runtimeHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'localhost'
  : window.location.hostname

export const apiBaseUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${runtimeHost}:3001`

axios.defaults.baseURL = apiBaseUrl
axios.defaults.withCredentials = false

export default axios
