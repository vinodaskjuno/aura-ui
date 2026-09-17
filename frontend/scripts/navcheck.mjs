import { readFileSync } from 'fs'

// Parse the nav without booting React: pull every { to, label, permission } triple
// and the group heading each sits under.
const src = readFileSync('src/components/layout/navGroups.ts', 'utf8')
const groups = []
for (const chunk of src.split(/label: '([A-Z]+)',\n\s*items: \[/).slice(1)) {
  if (/^[A-Z]+$/.test(chunk)) { groups.push({ label: chunk, items: [] }); continue }
  const g = groups[groups.length - 1]
  for (const m of chunk.matchAll(/label: '([^']+)',\s*icon: (\w+),\s*permission: '(\w+)'/g))
    g.items.push({ label: m[1], icon: m[2], permission: m[3] })
}

const ROLES = {
  user_dev: ['dashboard','dev_workspace','knowledge_graph','ontology','connectors','upload','logs'],
  user_qa: ['dashboard','qa_workspace','knowledge_graph','upload','logs'],
  user_ops: ['dashboard','aiops','observability','knowledge_graph','logs','connectors'],
  project_manager: ['dashboard'],
  product_owner: ['dashboard'],
  ontology_maintainer: ['dashboard','dev_workspace','knowledge_graph','ontology','ontology_maintain','connectors','scheduler','logs'],
  admin: ['dashboard','dev_workspace','qa_workspace','aiops','observability','knowledge_graph','ontology','ontology_maintain','connectors','upload','logs','settings','user_management','scheduler'],
}
ROLES.super_admin = ROLES.admin

const EXPECTED = { user_dev: 8, user_qa: 2, user_ops: 5, project_manager: 1,
                   product_owner: 1, ontology_maintainer: 10, admin: 15, super_admin: 15 }

let bad = 0
for (const [role, perms] of Object.entries(ROLES)) {
  const visible = groups.flatMap(g => g.items.filter(i => perms.includes(i.permission)))
  const shownGroups = groups.filter(g => g.items.some(i => perms.includes(i.permission))).map(g => g.label)
  const ok = visible.length === EXPECTED[role]
  if (!ok) bad++
  console.log(`${ok ? 'OK ' : 'BAD'} ${role.padEnd(20)} ${String(visible.length).padStart(2)}/${EXPECTED[role]}  groups: ${shownGroups.join(' ') || '(none)'}`)
}

// Icon collision check
const icons = groups.flatMap(g => g.items.map(i => i.icon))
const dupes = icons.filter((v, i) => icons.indexOf(v) !== i)
console.log(dupes.length ? `BAD duplicate icons: ${[...new Set(dupes)].join(', ')}` : 'OK  no duplicate icons')

console.log(`\n${groups.length} groups, sizes: ${groups.map(g => `${g.label}=${g.items.length}`).join(' ')}`)
process.exit(bad || dupes.length ? 1 : 0)
