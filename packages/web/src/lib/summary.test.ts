import { describe, expect, it } from 'vitest'
import type { Commit, CommitType } from '@shiplog/shared'
import { cleanSubject, dirOf, summarize, toMarkdown } from './summary'

let n = 0
function mk(p: {
  subject: string
  type?: CommitType
  scope?: string | null
  tickets?: string[]
  repo?: string
  date?: string
  files?: { path: string; ins: number; del: number; excluded?: boolean }[]
}): Commit {
  const files = (p.files ?? []).map((f) => ({ path: f.path, insertions: f.ins, deletions: f.del, excluded: !!f.excluded }))
  const live = files.filter((f) => !f.excluded)
  return {
    hash: 'h' + n++,
    repoId: p.repo ?? 'r1',
    date: p.date ?? '2026-11-02T10:00:00+08:00',
    authorEmail: 'a@b.c',
    authorName: 'A',
    subject: p.subject,
    body: '',
    refs: [],
    files,
    insertions: live.reduce((s, f) => s + f.insertions, 0),
    deletions: live.reduce((s, f) => s + f.deletions, 0),
    classification: { type: p.type ?? 'other', scope: p.scope ?? null, breaking: false, confidence: 'high' },
    tickets: p.tickets ?? [],
    mergeRequests: [],
  }
}

describe('cleanSubject', () => {
  it('strips CC prefix', () => {
    expect(cleanSubject('feat(DS-2204): 匯入 GPO')).toBe('匯入 GPO')
    expect(cleanSubject('fix!: crash on load')).toBe('crash on load')
    expect(cleanSubject('fix(manual-shots)：截圖錯誤')).toBe('截圖錯誤')
  })
  it('strips ticket key with brackets and punctuation', () => {
    expect(cleanSubject('feat: [DS-2204] 匯入 GPO', ['DS-2204'])).toBe('匯入 GPO')
    expect(cleanSubject('feat: 匯入 GPO (DS-2204)', ['DS-2204'])).toBe('匯入 GPO')
    expect(cleanSubject('DS-2204 - add export', ['DS-2204'])).toBe('add export')
    expect(cleanSubject('feat: DS-2204: add export', ['DS-2204'])).toBe('add export')
  })
  it('leaves non-CC subjects alone and never returns empty', () => {
    expect(cleanSubject('Merge branch main')).toBe('Merge branch main')
    expect(cleanSubject('DS-1', ['DS-1'])).toBe('DS-1')
  })
})

describe('summarize', () => {
  const commits = [
    mk({ subject: 'feat(DS-1): add A', type: 'feat', tickets: ['DS-1'], date: '2026-11-02T10:00:00', files: [{ path: 'src/components/A.vue', ins: 10, del: 0 }] }),
    mk({ subject: 'fix(DS-1): bug in A', type: 'fix', tickets: ['DS-1'], date: '2026-11-03T10:00:00', files: [{ path: 'src/components/A.vue', ins: 2, del: 1 }] }),
    mk({ subject: 'feat(DS-2): add B', type: 'feat', tickets: ['DS-2'], repo: 'r2', date: '2026-11-03T12:00:00' }),
    mk({ subject: 'fix(shots): crop', type: 'fix', scope: 'shots', date: '2026-11-04T10:00:00' }),
    mk({ subject: 'fix(shots): crop again', type: 'fix', scope: 'shots', date: '2026-11-04T11:00:00' }),
    mk({ subject: 'update readme', type: 'docs', date: '2026-11-04T11:30:00' }),
    mk({ subject: 'chore: bump', type: 'chore', date: '2026-11-05T10:00:00', files: [{ path: 'pnpm-lock.yaml', ins: 500, del: 400, excluded: true }, { path: 'package.json', ins: 1, del: 1 }] }),
    mk({ subject: 'ci: pipeline', type: 'ci', date: '2026-11-05T11:00:00' }),
  ]

  it('computes totals including noise', () => {
    const s = summarize(commits, { hideNoise: true })
    expect(s.totals).toMatchObject({ commits: 8, repos: 2, activeDays: 4, noiseHidden: 2, insertions: 10 + 2 + 1, deletions: 1 + 1 })
  })
  it('hides noise from groupings only when asked', () => {
    expect(summarize(commits, { hideNoise: true }).byType.map((g) => g.type)).toEqual(['feat', 'fix', 'docs'])
    const s = summarize(commits, { hideNoise: false })
    expect(s.byType.map((g) => g.type)).toEqual(['feat', 'fix', 'docs', 'ci', 'chore'])
    expect(s.totals.noiseHidden).toBe(0)
  })
  it('groups by ticket with derived title, dates, types', () => {
    const s = summarize(commits, { hideNoise: true })
    const ds1 = s.byTicket.find((g) => g.key === 'DS-1')!
    expect(ds1.items).toHaveLength(2)
    expect(ds1.title).toBe('add A') // tie -> earliest
    expect(ds1.types).toEqual(['feat', 'fix'])
    expect(ds1.last).toBeGreaterThan(ds1.first)
    expect(ds1.repoIds).toEqual(['r1'])
  })
  it('prefers real work over reverts for ticket titles', () => {
    const s = summarize(
      [
        mk({ subject: `Revert "feat(DS-9): x"`, type: 'revert', tickets: ['DS-9'], date: '2026-11-01T10:00:00' }),
        mk({ subject: 'feat(DS-9): import GPO', type: 'feat', tickets: ['DS-9'], date: '2026-11-02T10:00:00' }),
      ],
      { hideNoise: true },
    )
    expect(s.byTicket[0]!.title).toBe('import GPO')
  })
  it('puts ticketless commits in a No ticket bucket split by scope', () => {
    const s = summarize(commits, { hideNoise: true })
    const none = s.byTicket.at(-1)!
    expect(none.key).toBeNull()
    expect(none.items).toHaveLength(3)
    expect(none.scopes!.map((x) => [x.scope, x.items.length])).toEqual([['shots', 2], [null, 1]])
  })
  it('aggregates top dirs, skipping excluded files', () => {
    expect(dirOf('src/components/deep/A.vue')).toBe('src/components')
    expect(dirOf('src/a.ts')).toBe('src')
    expect(dirOf('README.md')).toBe('(root)')
    const s = summarize(commits, { hideNoise: false })
    expect(s.topDirs[0]).toEqual({ repoId: 'r1', dir: 'src/components', lines: 13, commits: 2 })
    expect(s.topDirs.find((d) => d.dir === '(root)')!.lines).toBe(2) // lockfile excluded
  })
  it('limits top dirs to 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => mk({ subject: 'x', files: [{ path: `d${i}/s/f.ts`, ins: i + 1, del: 0 }] }))
    expect(summarize(many, { hideNoise: true }).topDirs).toHaveLength(10)
  })
})

describe('toMarkdown', () => {
  const repoNames = { r1: 'alpha', r2: 'beta' }
  const commits = [
    mk({ subject: 'feat(DS-1): add A', type: 'feat', tickets: ['DS-1'], date: '2026-11-02T10:00:00' }),
    mk({ subject: 'fix(DS-1): bug in A', type: 'fix', tickets: ['DS-1'], date: '2026-11-03T10:00:00' }),
    mk({ subject: 'feat(DS-2): add B', type: 'feat', tickets: ['DS-2'], repo: 'r2' }),
    mk({ subject: 'fix(shots): crop', type: 'fix', scope: 'shots' }),
    mk({ subject: 'chore: bump', type: 'chore' }),
  ]
  it('ticket mode', () => {
    const md = toMarkdown(summarize(commits, { hideNoise: true }), { rangeLabel: 'Nov 2 – Nov 18', groupBy: 'ticket', repoNames })
    expect(md).toContain('## Nov 2 – Nov 18 · 5 commits · 2 repos')
    expect(md).toContain('_1 noise commit (chore/ci/style/build) not listed_')
    expect(md).toContain('### alpha')
    expect(md).toContain('### beta')
    expect(md).toContain('- **DS-1** add A — 2 commits, feat/fix')
    expect(md).toContain('- **DS-2** add B — 1 commit, feat')
    expect(md).toContain('- **No ticket · shots** crop — 1 commit, fix')
  })
  it('type mode caps bullets', () => {
    const many = Array.from({ length: 20 }, (_, i) => mk({ subject: `feat: thing ${i}`, type: 'feat', tickets: i === 0 ? ['DS-9'] : [] }))
    const md = toMarkdown(summarize([...many, commits[3]!], { hideNoise: true }), { rangeLabel: 'R', groupBy: 'type', repoNames })
    expect(md).toContain('**Features (20)**')
    expect(md).toContain('- thing 0 (DS-9)')
    expect(md).toContain('- …and 5 more')
    expect(md).not.toContain('- thing 19')
    expect(md).toContain('**Fixes (1)**')
    expect(md.indexOf('**Features')).toBeLessThan(md.indexOf('**Fixes'))
  })
})
