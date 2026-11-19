import { describe, expect, it } from 'vitest'
import { assignRepoColors } from './repoColors'

const palette = { light: ['L0', 'L1', 'L2'], dark: ['D0', 'D1', 'D2'] }
const other = { light: 'LO', dark: 'DO' }
const repo = (id: string, name = id) => ({ id, name })

describe('assignRepoColors', () => {
  it('gives top N repos palette colors in rank order, the rest Other', () => {
    const repos = ['a', 'b', 'c', 'd', 'e'].map((x) => repo(x))
    const counts = new Map([['a', 1], ['b', 50], ['c', 10], ['d', 5], ['e', 2]])
    const r = assignRepoColors(repos, counts, palette, other)
    expect(r.topRepoIds).toEqual(['b', 'c', 'd'])
    expect(r.colors.get('b')).toEqual({ light: 'L0', dark: 'D0' })
    expect(r.colors.get('d')).toEqual({ light: 'L2', dark: 'D2' })
    expect(r.colors.get('a')).toBe(other)
    expect(r.colors.get('e')).toBe(other)
    expect(r.isOther('a')).toBe(true)
    expect(r.isOther('b')).toBe(false)
  })

  it('breaks ties by name then id, deterministically', () => {
    const repos = [repo('2', 'x'), repo('1', 'x'), repo('3', 'a')]
    const counts = new Map([['1', 4], ['2', 4], ['3', 4]])
    expect(assignRepoColors(repos, counts, palette, other).topRepoIds).toEqual(['3', '1', '2'])
  })

  it('does not give slots to repos without commits and handles fewer repos than slots', () => {
    const r = assignRepoColors([repo('a'), repo('b')], new Map([['a', 3]]), palette, other)
    expect(r.topRepoIds).toEqual(['a'])
    expect(r.isOther('b')).toBe(true)
  })

  it('is stable regardless of input order', () => {
    const repos = ['a', 'b', 'c', 'd'].map((x) => repo(x))
    const counts = new Map([['a', 1], ['b', 2], ['c', 3], ['d', 4]])
    const x = assignRepoColors(repos, counts, palette, other).topRepoIds
    const y = assignRepoColors([...repos].reverse(), counts, palette, other).topRepoIds
    expect(x).toEqual(y)
  })
})
