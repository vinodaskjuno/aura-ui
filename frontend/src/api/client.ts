import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('ov_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  // A FormData body must NOT carry the client-wide application/json default.
  // Multipart needs `multipart/form-data; boundary=…`, and only the browser can
  // generate that boundary — so the header is deleted here and the browser fills
  // it in. Leaving the JSON default made the server fail to parse the body and
  // report every form field as missing, which surfaced as a validation error
  // rather than anything pointing at the content type.
  //
  // Fixed centrally rather than per call site: every existing FormData caller had
  // to remember to override it, and the one that forgot broke in a way that named
  // the wrong cause.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }

  return config
})

export default client
