import type { Range } from '../stores/app'

export const DAY = 86_400_000

export const dayStart = (t: number | Date) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
export const dayEnd = (t: number | Date) => {
  const d = new Date(t)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}
export const addDays = (t: number, n: number) => {
  const d = new Date(t)
  d.setDate(d.getDate() + n)
  return d.getTime()
}
/** Monday 00:00 local of the week containing t */
export const weekStart = (t: number) => {
  const d = new Date(dayStart(t))
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

const pad = (n: number) => String(n).padStart(2, '0')
/** local YYYY-MM-DD */
export const ymd = (t: number | Date) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** local midnight of a YYYY-MM-DD string, or null if invalid */
export function parseYmd(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(+m[1]!, +m[2]! - 1, +m[3]!)
  return ymd(d) === s ? d.getTime() : null
}

export const fmtShort = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
export const fmtLong = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

/** "Nov 4 – Nov 18, 2026 (14 days)"; the year appears once unless the range crosses years */
export function rangeLabel(r: Range): string {
  const days = Math.round((dayStart(r.to) - dayStart(r.from)) / DAY) + 1
  const a = new Date(r.from)
  const b = new Date(r.to)
  const left = a.getFullYear() === b.getFullYear() ? fmtShort(r.from) : fmtLong(r.from)
  return `${left} – ${fmtLong(r.to)} (${days} ${days === 1 ? 'day' : 'days'})`
}

export type PresetKey = 'twoWeeks' | 'month' | 'threeMonths' | 'sinceMeeting' | 'all'

export interface PresetContext {
  /** sorted YYYY-MM-DD */
  meetings: string[]
  /** start of full history */
  allFrom: number
}

export function presetRange(key: PresetKey, ctx?: PresetContext, now = Date.now()): Range | null {
  const to = dayEnd(now)
  const today = dayStart(now)
  switch (key) {
    case 'twoWeeks':
      return { from: addDays(today, -13), to }
    case 'month':
      return { from: new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime(), to }
    case 'threeMonths': {
      const d = new Date(today)
      d.setMonth(d.getMonth() - 3)
      return { from: d.getTime(), to }
    }
    case 'sinceMeeting': {
      const last = ctx?.meetings.at(-1)
      const from = last ? parseYmd(last) : null
      return from == null ? null : { from, to }
    }
    case 'all':
      return ctx ? { from: ctx.allFrom, to } : null
  }
}
