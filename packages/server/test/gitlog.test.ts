import { describe, expect, it } from 'vitest'
import { normalizePath, parseGitLog } from '../src/gitlog.js'

const R = '\x1e'
const F = '\x1f'
const fixture =
  `${R}aaa${F}2026-03-01T10:00:00+08:00${F}Me@Example.com${F}Me${F}feat(ui): add thing${F}Body line 1\n\nBody line 2 ABC-12${F}HEAD -> main, tag: v1${F}\n\n` +
  `10\t2\tsrc/a.ts\n-\t-\timg/logo.png\n5\t5\tpackage-lock.json\n3\t1\tsrc/{old => new}/b.ts\n1\t0\t{ => pkg}/c.ts\n4\t4\told.ts => new.ts\n` +
  `${R}bbb${F}2026-03-02T10:00:00+08:00${F}other@example.com${F}Other${F}fix: nope${F}${F}${F}\n\n1\t1\tx.ts\n` +
  `${R}ccc${F}2026-03-03T10:00:00+08:00${F}me@example.com${F}Me${F}chore: empty${F}${F}${F}`

const opts = { repoId: 'r1', authorEmails: ['me@example.com'], excludeFromStats: ['**/package-lock.json'] }

describe('parseGitLog', () => {
  const commits = parseGitLog(fixture, opts)

  it('filters by author email case-insensitively', () => {
    expect(commits.map((c) => c.hash)).toEqual(['aaa', 'ccc'])
  })
  it('parses multiline body, refs, tickets', () => {
    const c = commits[0]!
    expect(c.body).toBe('Body line 1\n\nBody line 2 ABC-12')
    expect(c.refs).toEqual(['HEAD -> main', 'tag: v1'])
    expect(c.tickets).toEqual(['ABC-12'])
    expect(c.classification).toMatchObject({ type: 'feat', scope: 'ui' })
  })
  it('handles binary, renames and excluded files', () => {
    const c = commits[0]!
    expect(c.files.map((f) => f.path)).toEqual([
      'src/a.ts', 'img/logo.png', 'package-lock.json', 'src/new/b.ts', '/pkg/c.ts'.slice(1), 'new.ts',
    ])
    expect(c.files[1]).toMatchObject({ insertions: 0, deletions: 0 })
    expect(c.files[2]!.excluded).toBe(true)
    expect(c.insertions).toBe(10 + 3 + 1 + 4)
    expect(c.deletions).toBe(2 + 1 + 0 + 4)
  })
  it('handles commits without files', () => {
    expect(commits[1]!.files).toEqual([])
  })
})

describe('normalizePath', () => {
  it('normalizes rename forms', () => {
    expect(normalizePath('a/{b => c}/d')).toBe('a/c/d')
    expect(normalizePath('a/{b => }/d')).toBe('a/d')
    expect(normalizePath('x => y')).toBe('y')
    expect(normalizePath('plain')).toBe('plain')
  })
})
