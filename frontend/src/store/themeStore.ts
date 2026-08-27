import { create } from 'zustand'

type Theme = 'dark1' | 'dark2' | 'light'

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  init: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'dark1',

  setTheme: (t) => {
    document.documentElement.dataset.theme = t
    localStorage.setItem('ov_theme', t)
    set({ theme: t })
  },

  init: () => {
    const stored = localStorage.getItem('ov_theme') as Theme | null
    const theme: Theme = stored === 'dark2' || stored === 'light' ? stored : 'dark1'
    document.documentElement.dataset.theme = theme
    set({ theme })
  },
}))
