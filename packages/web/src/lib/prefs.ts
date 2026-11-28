/** Pick a stored value: allowed as-is, a renamed legacy value mapped forward, else the fallback. Pure. */
export function resolvePref<T extends string>(raw: string | null, allowed: readonly T[], fallback: T, legacy: Record<string, T> = {}): T {
  if (raw !== null && allowed.includes(raw as T)) return raw as T
  if (raw !== null && Object.hasOwn(legacy, raw)) return legacy[raw]!
  return fallback
}

/** localStorage helpers that never throw (private windows, blocked storage). */
export function loadPref<T extends string>(key: string, allowed: readonly T[], fallback: T, legacy: Record<string, T> = {}): T {
  try {
    return resolvePref(localStorage.getItem(key), allowed, fallback, legacy)
  } catch {
    return fallback
  }
}
export function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}
