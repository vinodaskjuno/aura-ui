/**
 * UUID v4 generator that works outside secure contexts.
 *
 * `crypto.randomUUID()` is only defined in a SECURE CONTEXT — HTTPS, or a
 * localhost origin. On a plain-HTTP deployment (an ALB DNS name with no ACM
 * certificate, for instance) it is `undefined`, and calling it throws:
 *
 *     TypeError: crypto.randomUUID is not a function
 *
 * This is easy to miss in review because local dev on http://localhost:5173 IS
 * a secure context, so the native call always works there and only fails once
 * deployed.
 *
 * Resolution order, most to least preferred:
 *   1. crypto.randomUUID()      — native, secure contexts only
 *   2. crypto.getRandomValues() — available in INSECURE contexts too, so this
 *                                 is the branch that actually runs over HTTP.
 *                                 Still cryptographically strong.
 *   3. Math.random()            — last resort for ancient/exotic runtimes.
 *                                 NOT cryptographically strong; acceptable here
 *                                 only because these IDs are chat-session
 *                                 correlation keys, never secrets or tokens.
 */
export function safeUuid(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined

  // 1. Native — secure contexts.
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID()
  }

  // 2. getRandomValues — defined in insecure contexts too.
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    c.getRandomValues(bytes)
    // RFC 4122 §4.4: set the version (4) and variant (10xx) bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex: string[] = []
    for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1))
    return (
      hex[bytes[0]] + hex[bytes[1]] + hex[bytes[2]] + hex[bytes[3]] + '-' +
      hex[bytes[4]] + hex[bytes[5]] + '-' +
      hex[bytes[6]] + hex[bytes[7]] + '-' +
      hex[bytes[8]] + hex[bytes[9]] + '-' +
      hex[bytes[10]] + hex[bytes[11]] + hex[bytes[12]] +
      hex[bytes[13]] + hex[bytes[14]] + hex[bytes[15]]
    )
  }

  // 3. Math.random — not cryptographically strong. See the note above.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rnd = (Math.random() * 16) | 0
    const val = ch === 'x' ? rnd : (rnd & 0x3) | 0x8
    return val.toString(16)
  })
}

export default safeUuid
