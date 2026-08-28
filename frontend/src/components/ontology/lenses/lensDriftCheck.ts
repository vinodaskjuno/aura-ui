/**
 * Dev-only consistency check between the frontend lens registry and the
 * server-side definitions in aura-api/src/ontology/lenses.py.
 *
 * The two must agree on labels and typed edges, otherwise the client-side
 * projection and the /api/ontology/lens/{id} endpoint would disagree about what
 * a lens contains — which is exactly the drift the registry exists to prevent.
 * The backend already asserts itself against schema.py; this closes the loop.
 *
 * Reports to the console only. Never throws, never blocks render, no-op in prod.
 */
import { getLensCatalog } from '../../../api/ontologyUniverse'
import { LENSES } from './lensRegistry'

let ran = false

export async function checkLensDrift(): Promise<void> {
  if (!import.meta.env.DEV || ran) return
  ran = true

  let catalog
  try {
    catalog = await getLensCatalog()
  } catch {
    return   // backend down or endpoint absent — not this check's problem
  }

  const problems: string[] = []
  const serverById = new Map(catalog.lenses.map(l => [l.id, l]))

  for (const lens of LENSES) {
    // The ontology lens is client-only by design: it is the unscoped view and
    // has no server projection.
    if (lens.id === 'ontology') continue

    const server = serverById.get(lens.id)
    if (!server) {
      problems.push(`lens "${lens.id}" has no server definition`)
      continue
    }

    const clientLabels = new Set(Object.keys(lens.nodeTypes))
    const serverLabels = new Set(server.labels)
    const missing = [...serverLabels].filter(l => !clientLabels.has(l))
    const extra = [...clientLabels].filter(l => !serverLabels.has(l))
    if (missing.length) problems.push(`lens "${lens.id}": labels on server but not client: ${missing.join(', ')}`)
    if (extra.length) problems.push(`lens "${lens.id}": labels on client but not server: ${extra.join(', ')}`)

    // Aliases are declared client-side on purpose; they are not schema types.
    const clientRels = new Set(
      Object.entries(lens.edgeTypes).filter(([, c]) => !c.nonCanonical).map(([k]) => k),
    )
    const serverRels = new Set(server.relationshipTypes)
    const relMissing = [...serverRels].filter(r => !clientRels.has(r))
    const relExtra = [...clientRels].filter(r => !serverRels.has(r))
    if (relMissing.length) problems.push(`lens "${lens.id}": rel types on server but not client: ${relMissing.join(', ')}`)
    if (relExtra.length) problems.push(`lens "${lens.id}": rel types on client but not server: ${relExtra.join(', ')}`)
  }

  const unknownLabels = LENSES.flatMap(l =>
    Object.keys(l.nodeTypes)
      // The ontology lens keys its palette lowercase for historical reasons and
      // resolves case-insensitively, so exclude it from the canonical check.
      .filter(k => l.id !== 'ontology' && !catalog.labels.includes(k))
      .map(k => `lens "${l.id}": "${k}" is not in schema.ALL_LABELS`))
  problems.push(...unknownLabels)

  if (problems.length) {
    console.warn(
      `[lens drift] ${problems.length} mismatch(es) between the frontend registry and `
      + `aura-api/src/ontology/lenses.py:\n  ` + problems.join('\n  '),
    )
  } else {
    console.info('[lens drift] frontend and backend lens definitions agree')
  }
}
