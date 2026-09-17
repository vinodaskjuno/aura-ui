import { create } from 'zustand'

/**
 * DevMate's right-hand context rail: whether it is open, and which tab.
 *
 * Modelled on `sidebarStore` because the alternative was what dev-chat had — EIGHT
 * pieces of UI state in `useState`, every one lost on navigation and on a project
 * switch, against exactly one that persisted (`floci.terminal.<id>`). Someone who
 * opened the Policy panel to read a finding found it closed again the moment they
 * changed project and back.
 *
 * WIDER THAN THE OLD SIDEBAR, at 320 rather than 260. It now holds the machine
 * controls and the policy summary, not just a list of session names, and at 260 the
 * emulator rows wrapped.
 *
 * Open by DEFAULT, unlike the app sidebar. That rail is navigation you already know;
 * this one is state about the thing you are looking at, and hiding it by default is
 * how the four panels it replaces became invisible rather than merely tidy.
 */
const OPEN_KEY = 'ov_devmate_rail_open'
const TAB_KEY = 'ov_devmate_rail_tab'

export const RAIL_WIDTH = 320

export type RailTab = 'chat' | 'env' | 'checks'

const TABS: RailTab[] = ['chat', 'env', 'checks']

interface RailState {
  open: boolean
  tab: RailTab
  toggle: () => void
  setOpen: (open: boolean) => void
  /** Select a tab AND open the rail — what a status-strip segment does. */
  show: (tab: RailTab) => void
  init: () => void
}

function persist(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

export const useDevmateRailStore = create<RailState>((set, get) => ({
  open: true,
  tab: 'chat',

  toggle: () => {
    const next = !get().open
    persist(OPEN_KEY, next ? '1' : '0')
    set({ open: next })
  },

  setOpen: (open: boolean) => {
    persist(OPEN_KEY, open ? '1' : '0')
    set({ open })
  },

  show: (tab: RailTab) => {
    persist(TAB_KEY, tab)
    persist(OPEN_KEY, '1')
    set({ tab, open: true })
  },

  init: () => {
    try {
      // Absent means never chosen, which takes the open default — only an explicit
      // '0' closes it, so the default cannot override a preference already set.
      const open = localStorage.getItem(OPEN_KEY) !== '0'
      const stored = localStorage.getItem(TAB_KEY) as RailTab | null
      set({ open, tab: stored && TABS.includes(stored) ? stored : 'chat' })
    } catch { /* ignore */ }
  },
}))
