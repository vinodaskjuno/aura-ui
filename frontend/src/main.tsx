import './monacoSetup'
import React from 'react'
import ReactDOM from 'react-dom/client'
// Serve fonts locally — no Google Fonts CORS dependency
import '@fontsource/montserrat/400.css'
import '@fontsource/montserrat/500.css'
import '@fontsource/montserrat/600.css'
import '@fontsource/montserrat/700.css'
import '@fontsource/montserrat/800.css'
import '@fontsource/montserrat/900.css'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './index.css'
import App from './App'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'

// Initialize stores from localStorage before rendering
useAuthStore.getState().init()
useThemeStore.getState().init()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
