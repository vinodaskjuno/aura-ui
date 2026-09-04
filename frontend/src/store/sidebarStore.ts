import { create } from 'zustand'

/**
 * Whether the sidebar is pinned open or collapsed to an icon rail.
 *
 * Only the PINNED state lives here. Hover-expansion is transient and belongs to the
 * component: if the layout tracked it, brushing past the rail on the way to a button
 * would reflow the whole page under the cursor.
 */
const KEY = 'ov_sidebar_collapsed'

export const SIDEBAR_WIDTH = 224
// 76, not 68: the collapsed rail carries the full lockup — mark, name and the
// "AI DEV AGENT PLATFORM" line beneath it — and that tagline needs ~64px of usable
// width to wrap onto three lines without breaking a word.
export const SIDEBAR_RAIL = 76

interface SidebarState {
  collapsed: boolean
  toggle: () => void
  init: () => void
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  // Collapsed unless the user has said otherwise. The rail is the default because
  // it gives the page ~160px back and every item is still one hover from readable.
  collapsed: true,

  toggle: () => {
    const next = !get().collapsed
    try { localStorage.setItem(KEY, next ? '1' : '0') } catch { /* private mode */ }
    set({ collapsed: next })
  },

  init: () => {
    // Absent means "never chosen", which takes the collapsed default. Only an
    // explicit '0' — someone actually expanding it — opens the sidebar, so the
    // default cannot quietly override a preference that was already set.
    try { set({ collapsed: localStorage.getItem(KEY) !== '0' }) } catch { /* ignore */ }
  },
}))
