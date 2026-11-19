import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { defaultConfig, loadConfig } from '../src/config.js'
import { MemoryCommitStore } from '../src/store.js'

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ooo-cfg-')))
const dir = path.join(tmp, 'dir')
const file = path.join(tmp, 'file.txt')

describe('PUT /api/config validation', () => {
  const { app } = createApp({ store: new MemoryCommitStore(), allowMissingHost: true })
  const put = (body: unknown) =>
    app.request('/api/config', { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

  beforeAll(() => {
    process.env.ONE_ON_ONE_HOME = path.join(tmp, 'home')
    mkdirSync(dir)
    writeFileSync(file, 'x')
  })

  it('saves a valid config and round-trips', async () => {
    const cfg = { ...defaultConfig(), scanRoots: [dir], authorEmails: ['a@b.co'], meetings: ['2026-01-31'], classifier: { keywords: { fix: ['hot\\s?fix'] } } }
    const res = await put(cfg)
    expect(res.status).toBe(200)
    expect((await loadConfig()).scanRoots).toEqual([dir])
  })

  const cases: [string, Record<string, unknown>, string][] = [
    ['missing scan root', { scanRoots: [path.join(tmp, 'nope')] }, 'scanRoots'],
    ['scan root is a file', { scanRoots: [file] }, 'scanRoots'],
    ['missing pinned repo', { pinnedRepos: [path.join(tmp, 'nope')] }, 'pinnedRepos'],
    ['depth 0', { scanDepth: 0 }, 'scanDepth'],
    ['depth 11', { scanDepth: 11 }, 'scanDepth'],
    ['bad email', { authorEmails: ['not-an-email'] }, 'authorEmails'],
    ['bad meeting format', { meetings: ['01/02/2026'] }, 'meetings'],
    ['impossible meeting date', { meetings: ['2026-02-31'] }, 'meetings'],
    ['bad regex', { classifier: { keywords: { fix: ['(unclosed'] } } }, 'invalid regex'],
  ]
  for (const [name, patch, needle] of cases) {
    it(`rejects ${name}`, async () => {
      const res = await put({ ...defaultConfig(), ...patch })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string; details: string[] }
      expect(body.error).toBeTruthy()
      expect(body.details.some((d) => d.includes(needle))).toBe(true)
    })
  }

  it('reports multiple problems at once', async () => {
    const res = await put({ ...defaultConfig(), scanDepth: 99, authorEmails: ['x'] })
    expect(((await res.json()) as { details: string[] }).details).toHaveLength(2)
  })

  it('accepts ~ paths that exist', async () => {
    expect((await put({ ...defaultConfig(), scanRoots: ['~'] })).status).toBe(200)
  })

  it('refreshes repo cache after save', async () => {
    const repo = path.join(tmp, 'r1')
    mkdirSync(path.join(repo, '.git'), { recursive: true })
    await put({ ...defaultConfig(), scanRoots: [dir] })
    expect(await (await app.request('/api/repos')).json()).toEqual([])
    await put({ ...defaultConfig(), scanRoots: [tmp], scanDepth: 2 })
    const repos = (await (await app.request('/api/repos')).json()) as { name: string }[]
    expect(repos.map((r) => r.name)).toContain('r1')
  })
})
