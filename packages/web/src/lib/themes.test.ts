import { describe, expect, it } from 'vitest'
import type { Commit, Notes, Theme } from '@shiplog/shared'
import { groupByTheme, themeOf } from './themes'
import { summarize, toMarkdown } from './summary'

let n = 0
const mk = (p: { subject?: string; tickets?: string[]; repo?: string; hash?: string; date?: string }): Commit => ({
  hash: p.hash ?? 'h' + n++,
  repoId: p.repo ?? 'r1',
  date: p.date ?? '2026-11-02T10:00:00+08:00',
  authorEmail: 'a@b.c',
  authorName: 'A',
  subject: p.subject ?? 'feat: thing',
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

describe('themeOf', () => {
  it('returns null when nothing matches', () => {
    expect(themeOf(mk({ tickets: ['A-1'] }), [th('a'), th('b', { tickets: ['B-1'] })])).toBeNull()
  })
  it('explicit commit beats ticket beats repo, regardless of theme order', () => {
    const c = mk({ hash: 'x', tickets: ['A-1'], repo: 'r1' })
    const byRepo = th('repo', { repoIds: ['r1'] })
    const byTicket = th('ticket', { tickets: ['A-1'] })
    const byCommit = th('commit', { commits: ['r1:x'] })
    expect(themeOf(c, [byRepo, byTicket, byCommit])?.id).toBe('commit')
    expect(themeOf(c, [byRepo, byTicket])?.id).toBe('ticket')
    expect(themeOf(c, [byRepo])?.id).toBe('repo')
  })
  it('first theme in order wins within a tier', () => {
    const c = mk({ tickets: ['A-1', 'B-1'] })
    expect(themeOf(c, [th('one', { tickets: ['B-1'] }), th('two', { tickets: ['A-1'] })])?.id).toBe('one')
    expect(themeOf(c, [th('two', { tickets: ['A-1'] }), th('one', { tickets: ['B-1'] })])?.id).toBe('two')
  })
})

describe('groupByTheme + markdown', () => {
  const a1 = mk({ subject: 'feat(x): [PAY-1] add gateway', tickets: ['PAY-1'], hash: 'a1' })
  const a2 = mk({ subject: 'fix: [PAY-1] retry', tickets: ['PAY-1'], hash: 'a2' })
  const o1 = mk({ subject: 'feat: [OPS-9] pager', tickets: ['OPS-9'] })
  const loose = mk({ subject: 'feat: misc tidy', repo: 'r2' })
  const notes: Notes = {
    themes: [
      th('t1', { name: 'Payments', outcome: 'cut p95 to 300 ms', tickets: ['PAY-1'] }),
      th('t2', { name: 'Unused' }),
      th('t3', { name: 'On-call', tickets: ['OPS-9'] }),
    ],
    highlights: ['r1:a2'],
  }
  const summary = summarize([a1, a2, o1, loose], { hideNoise: true })
  const g = groupByTheme(summary.items, notes)

  it('splits cards, empty themes and unassigned', () => {
    expect(g.cards.map((c) => c.theme.id)).toEqual(['t1', 't3'])
    expect(g.empty.map((t) => t.id)).toEqual(['t2'])
    expect(g.cards[0]!.highlights.map((i) => i.commit.hash)).toEqual(['a2'])
    expect(g.unassigned).toHaveLength(1)
    expect(g.unassigned[0]!.key).toBeNull()
  })

  it('exports themes with outcome, highlights first, then other work', () => {
    const md = toMarkdown(summary, { rangeLabel: 'Nov 2026', groupBy: 'theme', repoNames: {}, themes: g })
    expect(md).toBe(
      [
        '## Nov 2026',
        '',
        '### Payments',
        '',
        'cut p95 to 300 ms',
        '',
        '- ★ retry (PAY-1)',
        '- **PAY-1** add gateway — 2 commits, feat',
        '',
        '### On-call',
        '',
        '_(no outcome written yet)_',
        '',
        '- **OPS-9** pager — 1 commit, feat',
        '',
        '### Other work',
        '',
        '- **No ticket** misc tidy — 1 commit, feat',
        '',
      ].join('\n'),
    )
    expect(md).not.toContain('Unused')
  })

  it('caps other work at 10 lines', () => {
    const many = Array.from({ length: 13 }, (_, i) => mk({ subject: `feat: t${i}`, tickets: [`Z-${i}`] }))
    const s = summarize(many, { hideNoise: true })
    const md = toMarkdown(s, { rangeLabel: 'R', groupBy: 'theme', repoNames: {}, themes: groupByTheme(s.items, { themes: [], highlights: [] }) })
    expect(md.match(/^- \*\*Z-/gm)).toHaveLength(10)
    expect(md).toContain('- …and 3 more')
  })
})
