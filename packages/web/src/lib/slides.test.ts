import { describe, expect, it } from 'vitest'
import type { Theme } from '@shiplog/shared'
import type { TimedCommit } from '../stores/app'
import { buildSlides, MAX_HIGHLIGHTS, MAX_OTHER, MAX_TICKETS, slideIndex, type OtherSlide, type ThemeSlide } from './slides'
import { dayEnd, dayStart } from './dates'

let n = 0
const at = (d: number, h = 10) => new Date(2026, 10, d, h).getTime()
const mk = (d: number, p: { tickets?: string[]; repo?: string; author?: string; subject?: string } = {}): TimedCommit => ({
  hash: 'h' + n++,
  repoId: p.repo ?? 'r1',
  date: new Date(at(d)).toISOString(),
  ts: at(d),
  authorEmail: 'a@b.c',
  authorName: p.author ?? 'Ann',
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
const range = { from: dayStart(at(1)), to: dayEnd(at(28)) }
const build = (commits: TimedCommit[], themes: Theme[], highlights: string[] = []) => buildSlides({ commits, notes: { themes, highlights }, range })

describe('buildSlides', () => {
  it('orders title, overview, themes in theme order, other', () => {
    const themes = [th('a', { tickets: ['A-1'] }), th('b', { tickets: ['B-1'] }), th('c', { tickets: ['C-1'] })]
    const cs = [mk(3, { tickets: ['C-1'] }), mk(4, { tickets: ['A-1'] }), mk(5)]
    const s = build(cs, themes)
    expect(s.map((x) => x.id)).toEqual(['title', 'overview', 'theme:a', 'theme:c', 'other'])
    expect(s[0]).toMatchObject({ themes: 2, tickets: 2, repos: 1, commits: 3, author: 'Ann' })
  })
  it('flags a missing outcome and trims a written one', () => {
    const [, , a, b] = build([mk(3, { tickets: ['A-1'] }), mk(4, { tickets: ['B-1'] })], [th('a', { tickets: ['A-1'] }), th('b', { tickets: ['B-1'], outcome: '  won  ' })]) as [unknown, unknown, ThemeSlide, ThemeSlide]
    expect(a).toMatchObject({ outcome: '', hasOutcome: false })
    expect(b).toMatchObject({ outcome: 'won', hasOutcome: true })
  })
  it('caps top tickets by commit count and highlights', () => {
    const cs: TimedCommit[] = []
    for (let i = 1; i <= 8; i++) for (let j = 0; j < i; j++) cs.push(mk(3 + (j % 5), { tickets: [`T-${i}`] }))
    const stars = cs.slice(0, 9).map((c) => `r1:${c.hash}`)
    const [, , t] = build(cs, [th('a', { repoIds: ['r1'] })], stars) as [unknown, unknown, ThemeSlide]
    expect(t.tickets).toHaveLength(MAX_TICKETS)
    expect(t.tickets[0]).toMatchObject({ key: 'T-8', commits: 8 })
    expect(t.moreTickets).toBe(2)
    expect(t.highlights).toHaveLength(MAX_HIGHLIGHTS)
    expect(t.moreHighlights).toBe(3)
    expect(t.highlights[0]!.title).toBe('thing')
  })
  it('summarises other work and caps it', () => {
    const cs = Array.from({ length: 11 }, (_, i) => mk(3, { tickets: [`X-${i}`] }))
    const o = build(cs, []).at(-1) as OtherSlide
    expect(o).toMatchObject({ kind: 'other', commits: 11, moreTickets: 11 - MAX_OTHER })
    expect(o.tickets).toHaveLength(MAX_OTHER)
  })
  it('without themes gives title, overview, other work', () => {
    expect(build([mk(3, { tickets: ['X-1'] })], []).map((x) => x.kind)).toEqual(['title', 'overview', 'other'])
  })
  it('omits other work when everything is themed and the author when unknown', () => {
    const s = build([mk(3, { tickets: ['A-1'], author: ' ' })], [th('a', { tickets: ['A-1'] })])
    expect(s.map((x) => x.kind)).toEqual(['title', 'overview', 'theme'])
    expect(s[0]).toMatchObject({ author: null })
  })
})

describe('slideIndex', () => {
  it('is 1-based and clamped', () => {
    expect(slideIndex('3', 5)).toBe(2)
    expect(slideIndex('99', 5)).toBe(4)
    expect(slideIndex(undefined, 5)).toBe(0)
    expect(slideIndex('x', 5)).toBe(0)
    expect(slideIndex('0', 5)).toBe(0)
  })
})
