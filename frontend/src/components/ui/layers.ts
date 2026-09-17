/**
 * One stacking order for the whole app.
 *
 * There was none, and it showed: a census of `zIndex` across `src` found **25 distinct
 * values** (0,1,2,10,14,15,19,20,30,35,40,41,50,60,100,200,300,500,800,900,950,999,1000,
 * 2000,9990) with **nine different tiers all meaning "a modal"**. Five files
 * independently picked 1000. `ProjectGraphModal` sits at 9990 and therefore wins against
 * everything else by accident rather than by intent.
 *
 * The practical failure is not ugliness. It is that a drawer opened from inside a modal,
 * or a confirm dialog opened from inside a drawer, lands underneath the thing that
 * opened it — and which way round it goes depends on which two components happen to meet.
 *
 * The scale is deliberately coarse. Six steps, generous gaps, and no component should
 * ever add or subtract from one: if two things need to sit at the same level, the later
 * one in the DOM wins, which is what stacking contexts already do correctly.
 */
export const LAYERS = {
  /** In-page chrome that floats over content but under everything interactive:
   *  sticky headers, floating breadcrumbs, canvas overlays. */
  FLOATING: 10,
  /** The app sidebar. Above page content, below anything that takes over the screen. */
  NAV: 50,
  /** A persistent in-page rail — DevMate's context panel. Above nav so its own
   *  popovers are not clipped, below anything modal. */
  RAIL: 100,
  /** Popovers, dropdowns and tooltips anchored to a control. */
  POPOVER: 400,
  /** Slide-over panels. Below modals: a modal opened FROM a drawer must cover it. */
  DRAWER: 800,
  /** Dialogs that take the screen, and their backdrop. */
  MODAL: 900,
  /** Transient notifications. Above everything, because they report on it. */
  TOAST: 1000,
} as const

export type Layer = typeof LAYERS[keyof typeof LAYERS]

/** The one backdrop. Five recipes existed — `rgba(0,0,0,0.65)+blur(4px)`,
 *  `rgba(0,0,0,.6)+blur(2px)`, `rgba(0,0,0,.6)`, `rgba(0,0,0,.85)`,
 *  `rgba(0,0,0,0.92)` — so the same action dimmed the page by a different amount
 *  depending on which component ran it. */
export const BACKDROP = 'rgba(0, 0, 0, 0.62)'
export const BACKDROP_BLUR = 'blur(3px)'
