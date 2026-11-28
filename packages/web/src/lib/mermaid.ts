import type { Range } from '../stores/app'
import { GANTT_DAILY_MAX_DAYS, type GanttRow } from './charts'
import { addDays, DAY, dayStart, ymd } from './dates'

const MAX_NAME = 60
/** gaps longer than this split a theme's activity into separate bars */
const GAP_WEEKS = 3
const GAP_DAYS = 3

/** Make a string safe as a gantt task/section name: no `: # ; %%` or newlines, trimmed, capped, never empty. */
export function mermaidName(s: string, fallback = 'Untitled'): string {
  const t = s.replace(/%%/g, ' ').replace(/[:#;\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const out = t.length > MAX_NAME ? t.slice(0, MAX_NAME - 1).trimEnd() + '…' : t
  return out || fallback
}

/** exclusive end day for a bucket end (23:59:59.999 or the next Monday 00:00) */
const endDay = (end: number) => ymd(addDays(dayStart(end - 1), 1))

/** Merge a row's buckets into stretches; a gap above the threshold starts a new one. */
function stretches(row: GanttRow, daily: boolean): { start: number; end: number }[] {
  const maxGap = daily ? GAP_DAYS * DAY : GAP_WEEKS * 7 * DAY
  const out: { start: number; end: number }[] = []
  for (const b of [...row.buckets].sort((a, b) => a.start - b.start)) {
    const last = out.at(-1)
    if (last && b.start - last.end <= maxGap) last.end = Math.max(last.end, b.end)
    else out.push({ start: b.start, end: b.end })
  }
  return out
}

/**
 * Mermaid `gantt` text for the themes timeline: one section per theme (then "Other work", muted),
 * one bar per activity stretch, one milestone per starred commit. Null when there are no rows.
 */
export function themeGanttMermaid(rows: GanttRow[], range: Range, opts: { title: string }): string | null {
  if (!rows.length) return null
  const days = (range.to - range.from) / DAY
  const daily = days <= GANTT_DAILY_MAX_DAYS
  const out = ['gantt', `  title ${mermaidName(opts.title, 'Themes')}`, '  dateFormat YYYY-MM-DD', `  axisFormat ${days > 120 ? '%b' : '%b %d'}`]
  rows.forEach((row, i) => {
    const name = mermaidName(row.name)
    out.push(`  section ${name}`)
    const other = row.colorIdx < 0
    stretches(row, daily).forEach((s, j) => out.push(`  ${name} :${other ? 'done, ' : ''}t${i}_${j}, ${ymd(s.start)}, ${endDay(s.end)}`))
    row.starred.forEach((h, j) => out.push(`  ${mermaidName(h.title, 'Highlight')} :milestone, m${i}_${j}, ${ymd(h.ts)}, 0d`))
  })
  return out.join('\n') + '\n'
}
