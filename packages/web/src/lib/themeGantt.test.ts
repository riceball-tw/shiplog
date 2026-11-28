import { describe, expect, it } from 'vitest'
import type { Theme } from '@shiplog/shared'
import type { TimedCommit } from '../stores/app'
import { buildThemeGanttOption, OTHER_ROW_ID, themeGanttHeight, themeGanttRows, GANTT_ROW_HEIGHT } from './charts'
import { chartTheme } from './charts'
import { dayEnd, dayStart } from './dates'

let n = 0
const at = (m: number, d: number, h = 10) => new Date(2026, m - 1, d, h).getTime()
const mk = (ts: number, p: { tickets?: string[]; repo?: string } = {}): TimedCommit => ({
  hash: 'h' + n++,
  repoId: p.repo ?? 'r1',
  date: new Date(ts).toISOString(),
  ts,
  authorEmail: 'a@b.c',
  authorName: 'A',
  subject: 'feat: x',
  body: '',
  refs: [],
  files: [],
  insertions: 0,
  deletions: 0,
  classification: { type: 'feat', scope: null, breaking: false, confidence: 'high' },
  tickets: p.tickets ?? [],
  mergeRequests: [],
})
const th = (id: string, over: Partial<Theme> = {}): Theme => ({ id, name: id, outcome: '', tickets: [], commits: [], repoIds: [], ...over })
const short = { from: dayStart(at(11, 1)), to: dayEnd(at(11, 14)) }
const long = { from: dayStart(at(1, 1)), to: dayEnd(at(12, 31)) }

describe('themeGanttRows', () => {
  it('keeps theme order, skips empty themes, appends Other work only when needed', () => {
    const themes = [th('a', { tickets: ['A-1'] }), th('b', { tickets: ['B-1'] }), th('c', { tickets: ['C-1'] })]
    const cs = [mk(at(11, 3), { tickets: ['C-1'] }), mk(at(11, 4), { tickets: ['A-1'] })]
    expect(themeGanttRows(cs, themes, [], short).map((r) => [r.id, r.colorIdx])).toEqual([['a', 0], ['c', 2]])
    const rows = themeGanttRows([...cs, mk(at(11, 5))], themes, [], short)
    expect(rows.at(-1)).toMatchObject({ id: OTHER_ROW_ID, name: 'Other work', colorIdx: -1, commits: 1 })
  })
  it('computes span, counts and stars', () => {
    const a = mk(at(11, 3), { tickets: ['A-1'] })
    const b = mk(at(11, 9), { tickets: ['A-1', 'A-2'] })
    const [row] = themeGanttRows([b, a], [th('a', { tickets: ['A-1', 'A-2'], outcome: ' won ' })], [`r1:${b.hash}`], short)
    expect(row).toMatchObject({ first: dayStart(a.ts), last: dayEnd(b.ts), tickets: 2, commits: 2, outcome: 'won', stars: [b.ts] })
  })
  it('buckets per day on short ranges and per week on long ones', () => {
    const cs = [mk(at(11, 3, 9), { tickets: ['A-1'] }), mk(at(11, 3, 15), { tickets: ['A-1'] }), mk(at(11, 4), { tickets: ['A-1'] })]
    const t = [th('a', { tickets: ['A-1'] })]
    expect(themeGanttRows(cs, t, [], short)[0]!.buckets.map((b) => b.count)).toEqual([2, 1])
    // Mon Nov 2 .. Sun Nov 8 is one week
    const weekly = themeGanttRows(cs, t, [], long)[0]!.buckets
    expect(weekly.map((b) => b.count)).toEqual([3])
    expect(weekly[0]!.start).toBeGreaterThanOrEqual(themeGanttRows(cs, t, [], long)[0]!.first)
  })
  it('clamps the span to the range', () => {
    const c = mk(at(11, 1, 0), { tickets: ['A-1'] })
    const [row] = themeGanttRows([c], [th('a', { tickets: ['A-1'] })], [], { from: c.ts, to: short.to })
    expect(row!.first).toBe(c.ts)
  })
  it('returns nothing without commits', () => {
    expect(themeGanttRows([], [th('a')], [], short)).toEqual([])
  })
})

describe('buildThemeGanttOption', () => {
  it('builds a time axis over the range with one category per row', () => {
    const rows = themeGanttRows([mk(at(11, 3), { tickets: ['A-1'] })], [th('a', { tickets: ['A-1'] })], [], short)
    const o: any = buildThemeGanttOption({ rows, range: short, colors: ['#111'], otherColor: '#999', theme: chartTheme(false) })
    expect(o.xAxis).toMatchObject({ min: short.from, max: short.to })
    expect(o.yAxis.data).toEqual(['a'])
    expect(o.grid).toMatchObject({ left: 110, right: 12 })
  })
  it('escapes HTML in the tooltip', () => {
    const rows = themeGanttRows([mk(at(11, 3), { tickets: ['A-1'] })], [th('a', { name: '<b>x</b>', tickets: ['A-1'] })], [], short)
    const o: any = buildThemeGanttOption({ rows, range: short, colors: ['#111'], otherColor: '#999', theme: chartTheme(false) })
    const html = o.tooltip.formatter({ data: { row: 0 } })
    expect(html).not.toContain('<b>x')
    expect(html).toContain('no outcome yet')
  })
  it('scales height with rows', () => {
    expect(themeGanttHeight(3) - themeGanttHeight(2)).toBe(GANTT_ROW_HEIGHT)
  })
})
