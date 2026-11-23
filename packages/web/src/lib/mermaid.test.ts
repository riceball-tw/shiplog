import { describe, expect, it } from 'vitest'
import type { Theme } from '@shiplog/shared'
import type { TimedCommit } from '../stores/app'
import { themeGanttRows } from './charts'
import { dayEnd, dayStart } from './dates'
import { mermaidName, themeGanttMermaid } from './mermaid'
import { renderMermaid, standaloneSvg } from './mermaidImage'

let n = 0
const at = (m: number, d: number, h = 10) => new Date(2026, m - 1, d, h).getTime()
const mk = (ts: number, p: { tickets?: string[]; subject?: string } = {}): TimedCommit => ({
  hash: 'h' + n++,
  repoId: 'r1',
  date: new Date(ts).toISOString(),
  ts,
  authorEmail: 'a@b.c',
  authorName: 'A',
  subject: p.subject ?? 'feat: x',
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
const short = { from: dayStart(at(11, 1)), to: dayEnd(at(11, 30)) }
const long = { from: dayStart(at(1, 1)), to: dayEnd(at(12, 31)) }
const build = (cs: TimedCommit[], themes: Theme[], stars: string[], range = short) =>
  themeGanttMermaid(themeGanttRows(cs, themes, stars, range), range, { title: 'Range' })

describe('mermaidName', () => {
  it('strips breaking characters, trims, truncates, never empty', () => {
    expect(mermaidName('  a: b #c; d\ne  ')).toBe('a b c d e')
    expect(mermaidName('x%%y')).toBe('x y')
    expect(mermaidName(' :# ')).toBe('Untitled')
    const long = mermaidName('x'.repeat(100))
    expect(long).toHaveLength(60)
    expect(long.endsWith('…')).toBe(true)
  })
})

describe('themeGanttMermaid', () => {
  const themes = [th('A', { tickets: ['A-1'] }), th('B', { tickets: ['B-1'] })]
  it('returns null without rows', () => {
    expect(build([], themes, [])).toBeNull()
  })
  it('emits header, a section per theme, then muted Other work', () => {
    const t = build([mk(at(11, 3), { tickets: ['A-1'] }), mk(at(11, 4), { tickets: ['B-1'] }), mk(at(11, 5))], themes, [])!
    expect(t).toBe(
      [
        'gantt',
        '  title Range',
        '  dateFormat YYYY-MM-DD',
        '  axisFormat %b %d',
        '  section A',
        '  A :t0_0, 2026-11-03, 2026-11-04',
        '  section B',
        '  B :t1_0, 2026-11-04, 2026-11-05',
        '  section Other work',
        '  Other work :done, t2_0, 2026-11-05, 2026-11-06',
        '',
      ].join('\n'),
    )
  })
  it('merges nearby days and splits on gaps over 3 days (short range)', () => {
    const cs = [3, 4, 6, 12].map((d) => mk(at(11, d), { tickets: ['A-1'] }))
    const t = build(cs, themes, [])!
    expect(t).toContain('A :t0_0, 2026-11-03, 2026-11-07')
    expect(t).toContain('A :t0_1, 2026-11-12, 2026-11-13')
  })
  it('uses weeks on long ranges: gap over 3 weeks splits, axis is months', () => {
    const near = [mk(at(3, 2), { tickets: ['A-1'] }), mk(at(3, 30), { tickets: ['A-1'] })]
    const t1 = build(near, themes, [], long)!
    expect(t1).toContain('axisFormat %b\n')
    expect(t1.match(/:t0_\d/g)).toHaveLength(1)
    const far = [mk(at(3, 2), { tickets: ['A-1'] }), mk(at(5, 4), { tickets: ['A-1'] })]
    expect(build(far, themes, [], long)!.match(/:t0_\d/g)).toHaveLength(2)
  })
  it('turns starred commits into milestones with cleaned titles', () => {
    const c = mk(at(11, 5), { tickets: ['A-1'], subject: 'feat(x): A-1: ship it; now #1' })
    const t = build([mk(at(11, 3), { tickets: ['A-1'] }), c], themes, [`r1:${c.hash}`])!
    expect(t).toContain('  ship it now 1 :milestone, m0_0, 2026-11-05, 0d')
  })
  it('sanitizes theme names', () => {
    const t = build([mk(at(11, 3), { tickets: ['A-1'] })], [th('A', { name: ' Pay: #ments; ', tickets: ['A-1'] })], [])!
    expect(t).toContain('section Pay ments\n')
  })
})

describe('pele parses the output', () => {
  const themes = [th('A', { tickets: ['A-1'] }), th('B', { name: 'Bé: ünïcode #x', tickets: ['B-1'] })]
  const star = mk(at(11, 6), { tickets: ['A-1'], subject: 'feat: big: thing' })
  const fixtures: [string, string | null][] = [
    ['short with stars and other', build([mk(at(11, 3), { tickets: ['A-1'] }), star, mk(at(11, 20), { tickets: ['B-1'] }), mk(at(11, 9))], themes, [`r1:${star.hash}`])],
    ['single commit', build([mk(at(11, 3), { tickets: ['A-1'] })], themes, [])],
    ['long range', build([mk(at(2, 3), { tickets: ['A-1'] }), mk(at(8, 3), { tickets: ['A-1'] }), mk(at(9, 3), { tickets: ['B-1'] })], themes, [], long)],
    ['only other', build([mk(at(11, 3))], [], [])],
  ]
  for (const [name, text] of fixtures)
    it(name, () => {
      const r = renderMermaid(text!)
      expect(r.svg).toContain('<svg')
      const s = standaloneSvg(r)
      expect(s).not.toContain('var(')
      expect(s).toContain('<rect width=')
    })
})
