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
  /**
   * Every nav group those menus live in.
   *
   * Was a single `group`, taken from the first group the permission appeared in. That
   * was accurate only while each permission stayed inside one group, which stopped
   * being true when the nine-item WORKSPACE group was split five ways:
   * `dev_workspace` unlocks DevMate (AGENTS), Reverse Eng. (BUILD) and AI Traces
   * (OBSERVE), so the editor would have filed one row under BUILD while listing menus
   * from three sections — quietly wrong in the screen whose entire job is telling an
   * administrator what they are granting.
   */
  groups: string[]
}

export function buildMenuPermissions(
  groups: { label: string; items: { permission: string; label: string }[] }[],
): MenuPermission[] {
  const byKey = new Map<string, MenuPermission>()
  for (const nav of groups) {
    for (const item of nav.items) {
      const found = byKey.get(item.permission)
      if (found) {
        found.menus.push(item.label)
        // A permission spanning groups lists them all; one spanning none twice
        // must not list the same group twice.
        if (!found.groups.includes(nav.label)) found.groups.push(nav.label)
      } else {
        byKey.set(item.permission,
          { key: item.permission, menus: [item.label], groups: [nav.label] })
      }
    }
  }
  return [...byKey.values()]
}
