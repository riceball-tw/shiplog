import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { saveConfig, defaultConfig } from '../src/config.js'
import { discoverRepos } from '../src/discovery.js'
import { MemoryCommitStore } from '../src/store.js'

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ooo-')))
const root = path.join(tmp, 'projects')
const ME = 'me@example.com'

function git(cwd: string, args: string[], email = ME) {
  execFileSync('git', args, {
    cwd,
    stdio: 'pipe',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Tester', GIT_AUTHOR_EMAIL: email,
      GIT_COMMITTER_NAME: 'Tester', GIT_COMMITTER_EMAIL: email,
    },
  })
}

function commit(cwd: string, file: string, content: string, msg: string, email = ME) {
  writeFileSync(path.join(cwd, file), content)
  git(cwd, ['add', '-A'], email)
  git(cwd, ['commit', '-q', '-m', msg], email)
}

describe('discovery + scan', () => {
  const alpha = path.join(root, 'alpha')
  const clone = path.join(root, 'nested', 'alpha-clone')
  const beta = path.join(root, 'beta')

  beforeAll(async () => {
    process.env.ONE_ON_ONE_HOME = path.join(tmp, 'home')
    mkdirSync(alpha, { recursive: true })
    git(alpha, ['init', '-q'])
    commit(alpha, 'a.ts', 'one\n', 'feat(core): add a ABC-1 (!3)')
    commit(alpha, 'package-lock.json', 'lock\n', 'chore: lock')
    commit(alpha, 'a.ts', 'one\ntwo\n', 'fix: bug', 'someone@else.com')
    mkdirSync(path.dirname(clone), { recursive: true })
    execFileSync('git', ['clone', '-q', alpha, clone])
    mkdirSync(beta, { recursive: true })
    git(beta, ['init', '-q'])
    commit(beta, 'b.ts', 'x\n', 'Refactor b')
    // ignored and nested-in-repo dirs
    mkdirSync(path.join(root, 'node_modules', 'dep'), { recursive: true })
    git(path.join(root, 'node_modules', 'dep'), ['init', '-q'])
    mkdirSync(path.join(alpha, 'sub'), { recursive: true })
    git(path.join(alpha, 'sub'), ['init', '-q'])
    await saveConfig({ ...defaultConfig(), scanRoots: [root], authorEmails: ['ME@example.com'] })
  })

  it('discovers repos, skipping ignored dirs and not descending into repos', async () => {
    const repos = await discoverRepos({ ...defaultConfig(), scanRoots: [root], excludedRepos: [beta] })
    expect(repos.map((r) => r.name).sort()).toEqual(['alpha', 'alpha-clone', 'beta'])
    expect(repos.find((r) => r.name === 'beta')!.included).toBe(false)
    expect(repos[0]!.id).toMatch(/^[0-9a-f]{12}$/)
  })

  it('scans via the API, dedupes clones, filters authors', async () => {
    const store = new MemoryCommitStore()
    const { app } = createApp({ store, allowMissingHost: true })
    const res = await app.request('/api/scan', { method: 'POST' })
    const result = await res.json()
    expect(result.repos).toBe(3)
    expect(result.errors).toEqual([])
    // alpha: 2 of mine (clone dupes dropped); beta: 1
    expect(result.newCommits).toBe(3)

    const commits = await (await app.request('/api/commits')).json()
    expect(commits).toHaveLength(3)
    const feat = commits.find((c: any) => c.subject.startsWith('feat'))
    expect(feat.classification).toMatchObject({ type: 'feat', scope: 'core', confidence: 'high' })
    expect(feat.tickets).toEqual(['ABC-1'])
    expect(feat.mergeRequests).toEqual(['!3'])
    const lock = commits.find((c: any) => c.subject === 'chore: lock')
    expect(lock.insertions).toBe(0)
    expect(lock.files[0].excluded).toBe(true)

    const heat = await (await app.request('/api/heatmap')).json()
    expect(heat.reduce((n: number, r: any) => n + r.commits, 0)).toBe(3)

    const future = await (await app.request('/api/commits?from=2999-01-01')).json()
    expect(future).toEqual([])

    const authors = await (await app.request('/api/authors')).json()
    expect(authors.map((a: any) => a.email).sort()).toEqual([ME, 'someone@else.com'])
  })

  it('a broken repo does not fail the scan', async () => {
    const broken = path.join(root, 'broken')
    mkdirSync(path.join(broken, '.git'), { recursive: true })
    const { app } = createApp({ store: new MemoryCommitStore(), allowMissingHost: true })
    const result = await (await app.request('/api/scan', { method: 'POST' })).json()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].repoPath).toBe(broken)
    expect(result.newCommits).toBe(3)
  })

  it('a rescan drops commits no longer matching the config', async () => {
    const store = new MemoryCommitStore()
    const { app } = createApp({ store, allowMissingHost: true })
    await app.request('/api/scan', { method: 'POST' })
    expect(await (await app.request('/api/commits')).json()).toHaveLength(3)

    const put = (cfg: object) =>
      app.request('/api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg) })
    const cfg = await (await app.request('/api/config')).json()
    await put({ ...cfg, authorEmails: ['someone@else.com'] })
    await app.request('/api/scan', { method: 'POST' })
    const commits = await (await app.request('/api/commits')).json()
    expect(commits.map((c: any) => c.subject)).toEqual(['fix: bug'])

    await put(cfg)
  })

  it('keeps commits of a repo that fails to rescan', () => {
    const store = new MemoryCommitStore()
    const mk = (hash: string, repoId: string) => ({ hash, repoId, date: '2026-01-01T00:00:00Z' }) as any
    store.replace([mk('a1', 'a'), mk('b1', 'b')])
    expect(store.replace([mk('a2', 'a')], ['b'])).toBe(1)
    expect(store.query({}).map((c) => c.hash).sort()).toEqual(['a2', 'b1'])
  })

  it('serves health and config', async () => {
    const { app } = createApp({ store: new MemoryCommitStore(), allowMissingHost: true })
    expect(await (await app.request('/api/health')).json()).toEqual({ ok: true })
    const cfg = await (await app.request('/api/config')).json()
    expect(cfg.scanRoots).toEqual([root])
  })
})
