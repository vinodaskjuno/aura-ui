/**
 * Turn an API error into something a human can act on.
 *
 * FastAPI returns `detail` as a STRING for HTTPException but as an ARRAY of
 * `{loc, msg, type}` objects for request-validation failures. Interpolating the
 * array into a template gives "[object Object],[object Object]…", which is what a
 * user actually saw — an error that hid its own cause.
 */
export function describeApiError(err: unknown, fallback = 'Request failed'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail

  if (typeof detail === 'string' && detail.trim()) return detail

  if (Array.isArray(detail)) {
    const parts = detail
      .map(item => {
        if (typeof item === 'string') return item
        const e = item as { loc?: unknown[]; msg?: string }
        // Drop the leading "body"/"query" segment: it is noise to a user.
        const field = Array.isArray(e.loc)
          ? e.loc.filter(p => p !== 'body' && p !== 'query').join('.')
          : ''
        return field ? `${field}: ${e.msg ?? 'invalid'}` : (e.msg ?? 'invalid')
      })
      .filter(Boolean)
    if (parts.length) return parts.join('; ')
  }

  const message = (err as { message?: string })?.message
  return message || fallback
}
