/**
 * Which accent a section wears.
 *
 * Two channels of colour on this page, and they must never be mistaken for
 * each other:
 *
 *   IDENTITY  — the section accent. Cool hues, assigned by position, applied
 *               only to CHROME: the label, the rule, a tile's wash and border,
 *               a sparkline at rest. It says "you are in the Platform section".
 *
 *   STATE     — warning and danger. Warm hues, applied only to the NUMBER and
 *               to the attention rail. It says "this is wrong".
 *
 * Because identity is always cool and state is always warm, a red number is
 * unmistakable no matter which section it sits in. That is the whole reason the
 * palette in index.css excludes amber and red.
 */

export const ACCENT_COUNT = 6

/** Cycles, so a role with more sections than accents never runs out. */
export function sectionAccent(index: number): string {
  return `var(--accent-${(index % ACCENT_COUNT) + 1})`
}

/** A wash faint enough to sit under text without tinting it. */
export function accentSurface(accent: string): string {
  return `color-mix(in srgb, ${accent} 7%, var(--color-card))`
}

export function accentBorder(accent: string, strength = 22): string {
  return `color-mix(in srgb, ${accent} ${strength}%, var(--color-border))`
}
