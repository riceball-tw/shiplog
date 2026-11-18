import { describe, expect, it } from 'vitest'
import { classify, parseRefs } from '../src/classify.js'

describe('classify', () => {
  it('parses conventional commits with scope', () => {
    expect(classify('feat(api): add endpoint')).toEqual({
      type: 'feat', scope: 'api', breaking: false, confidence: 'high',
    })
  })
  it('detects breaking via ! and body', () => {
    expect(classify('fix!: drop old field').breaking).toBe(true)
    expect(classify('refactor: x', [], {}, 'BREAKING CHANGE: gone').breaking).toBe(true)
  })
  it('treats unknown CC types as unmatched', () => {
    const c = classify('wip: fix the thing')
    expect(c.confidence).toBe('low')
    expect(c.type).toBe('fix')
  })
  it('uses keyword heuristics', () => {
    expect(classify('Fix crash on start').type).toBe('fix')
    expect(classify('Implement search').type).toBe('feat')
    expect(classify('Cleanup helpers').type).toBe('refactor')
    expect(classify('Optimize query').type).toBe('perf')
    expect(classify('Bump deps').type).toBe('build')
    expect(classify('Revert "x"').type).toBe('revert')
    expect(classify('Update README').type).toBe('docs')
  })
  it('does not match keywords inside words', () => {
    expect(classify('Prefix handling tweaks').type).toBe('other')
  })
  it('applies extra keywords first', () => {
    expect(classify('fix typo in hotpath', [], { perf: ['hotpath'] }).type).toBe('perf')
  })
  it('falls back to file heuristics', () => {
    expect(classify('misc', ['a.test.ts', 'src/__tests__/b.ts']).type).toBe('test')
    expect(classify('misc', ['README.md', 'docs/a.txt']).type).toBe('docs')
    expect(classify('misc', ['.github/workflows/ci.yml']).type).toBe('ci')
    expect(classify('misc', ['a.ts', 'a.test.ts']).type).toBe('other')
  })
  it('returns other/low otherwise', () => {
    expect(classify('misc')).toEqual({ type: 'other', scope: null, breaking: false, confidence: 'low' })
  })
})

describe('parseRefs', () => {
  it('extracts and dedupes tickets and MR refs', () => {
    expect(parseRefs('ABC-123 fix (!42) see #17\nABC-123 and XY2-9, &#39;')).toEqual({
      tickets: ['ABC-123', 'XY2-9'],
      mergeRequests: ['!42', '#17'],
    })
  })
})
