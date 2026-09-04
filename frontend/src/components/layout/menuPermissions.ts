/**
 * The menus each permission unlocks, derived from the nav itself.
 *
 * The org-role editor renders its checklist from this, so the list of menus an
 * administrator can grant is the list of menus that actually exist. A hand-kept
 * catalog beside this one is how you end up offering a permission that opens
 * nothing, or hiding a screen nobody can grant.
 */
export interface MenuPermission {
  key: string
  /** Every menu this permission unlocks — several items can share one key. */
  menus: string[]
  group: string
}

export function buildMenuPermissions(
  groups: { label: string; items: { permission: string; label: string }[] }[],
): MenuPermission[] {
  const byKey = new Map<string, MenuPermission>()
  for (const nav of groups) {
    for (const item of nav.items) {
      const found = byKey.get(item.permission)
      if (found) found.menus.push(item.label)
      else byKey.set(item.permission,
        { key: item.permission, menus: [item.label], group: nav.label })
    }
  }
  return [...byKey.values()]
}
