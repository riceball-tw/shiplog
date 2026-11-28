import { describe, expect, it } from 'vitest'
import type { Notes, Theme } from '@shiplog/shared'
import { clearSelect, moveWork, rangeSelect, toggleSelect, type WorkUnit } from './workDrag'
import { themeOf } from './themes'

const th = (id: string, over: Partial<Theme> = {}): Theme => ({ id, name: id, outcome: '', tickets: [], commits: [], repoIds: [], ...over })
const notes = (themes: Theme[]): Notes => ({ themes, highlights: ['r1:x'] })
const ticket = (k: string, commits: string[] = []): WorkUnit => ({ id: `t:${k}`, ticket: k, commits })
const loose = (commits: string[]): WorkUnit => ({ id: `c:${commits.join()}`, ticket: null, commits })

describe('selection', () => {
  it('toggles', () => {
    expect(toggleSelect([], 'a')).toEqual(['a'])
    expect(toggleSelect(['a', 'b'], 'a')).toEqual(['b'])
  })
  it('range is inclusive, either direction, unions with base', () => {
    const order = ['a', 'b', 'c', 'd', 'e']
    expect(rangeSelect(order, 'b', 'd', [])).toEqual(['b', 'c', 'd'])
    expect(rangeSelect(order, 'd', 'b', ['a'])).toEqual(['a', 'b', 'c', 'd'])
    expect(rangeSelect(order, 'zz', 'c', [])).toEqual(['c'])
  })
  it('clears', () => expect(clearSelect()).toEqual([]))
})

describe('moveWork', () => {
  it('moves a ticket between themes without duplicates', () => {
    const n = notes([th('a', { tickets: ['A-1'] }), th('b', { tickets: ['A-1', 'B-1'] })])
    const out = moveWork(n, 'b', [ticket('A-1')])
    expect(out.themes[0]!.tickets).toEqual([])
    expect(out.themes[1]!.tickets).toEqual(['B-1', 'A-1'])
    expect(out.highlights).toEqual(['r1:x'])
  })
  it('commit-key groups move by commit keys', () => {
    const n = notes([th('a', { commits: ['r1:1', 'r1:2'] }), th('b')])
    const out = moveWork(n, 'b', [loose(['r1:1'])])
    expect(out.themes[0]!.commits).toEqual(['r1:2'])
    expect(out.themes[1]!.commits).toEqual(['r1:1'])
  })
  it('null target unassigns', () => {
    const n = notes([th('a', { tickets: ['A-1'], commits: ['r1:1'] })])
    const out = moveWork(n, null, [ticket('A-1', ['r1:1'])])
    expect(out.themes[0]).toMatchObject({ tickets: [], commits: [] })
  })
  it('moving a ticket clears explicit commit overrides in other themes', () => {
    const n = notes([th('a', { commits: ['r1:1'] }), th('b')])
    const out = moveWork(n, 'b', [ticket('A-1', ['r1:1'])])
    expect(out.themes[0]!.commits).toEqual([])
    expect(out.themes[1]!.tickets).toEqual(['A-1'])
  })
  it('repo-level membership: explicit assignment in the target wins', () => {
    const n = notes([th('a', { repoIds: ['r1'] }), th('b')])
    const out = moveWork(n, 'b', [loose(['r1:1'])])
    const c = { hash: '1', repoId: 'r1', tickets: [] } as never
    expect(themeOf(c, out.themes)?.id).toBe('b')
    expect(out.themes[0]!.repoIds).toEqual(['r1'])
  })
  it('does not mutate the input', () => {
    const n = notes([th('a', { tickets: ['A-1'] }), th('b')])
    moveWork(n, 'b', [ticket('A-1')])
    expect(n.themes[0]!.tickets).toEqual(['A-1'])
  })
})
