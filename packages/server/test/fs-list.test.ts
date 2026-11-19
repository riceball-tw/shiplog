import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DirListing } from '@one-on-one/shared'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { MemoryCommitStore } from '../src/store.js'

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ooo-fs-')))
for (const d of ['beta/nested', 'Alpha/.git', 'gamma', '.hidden', 'filerepo']) mkdirSync(path.join(tmp, d), { recursive: true })
writeFileSync(path.join(tmp, 'file.txt'), 'x')
writeFileSync(path.join(tmp, 'filerepo/.git'), 'gitdir: x')
symlinkSync(path.join(tmp, 'gamma'), path.join(tmp, 'link-to-gamma'))
symlinkSync(path.join(tmp, 'nope'), path.join(tmp, 'broken'))

describe('GET /api/fs/list', () => {
  const { app } = createApp({ store: new MemoryCommitStore(), allowMissingHost: true })
  const get = (p?: string) => app.request(`/api/fs/list${p === undefined ? '' : `?path=${encodeURIComponent(p)}`}`)

  it('lists directories only, sorted, with git markers', async () => {
    const body = (await (await get(tmp)).json()) as DirListing
    expect(body.path).toBe(tmp)
    expect(body.parent).toBe(path.dirname(tmp))
    expect(body.entries.map((e) => e.name)).toEqual(['Alpha', 'beta', 'filerepo', 'gamma', 'link-to-gamma'])
    expect(body.entries.map((e) => e.isGitRepo)).toEqual([true, false, true, false, false])
  })
  it('lists nested dirs', async () => {
    const body = (await (await get(path.join(tmp, 'beta'))).json()) as DirListing
    expect(body.entries.map((e) => e.name)).toEqual(['nested'])
  })
  it('defaults to home and expands ~', async () => {
    const a = (await (await get()).json()) as DirListing
    const b = (await (await get('~')).json()) as DirListing
    expect(a.path).toBe(os.homedir())
    expect(b.path).toBe(os.homedir())
    expect(a.home).toBe(os.homedir())
  })
  it('404 for missing path, 400 for file or relative path', async () => {
    const res = await get(path.join(tmp, 'missing'))
    expect(res.status).toBe(404)
    expect(await res.json()).toHaveProperty('error')
    expect((await get(path.join(tmp, 'file.txt'))).status).toBe(400)
    expect((await get('relative/dir')).status).toBe(400)
  })
  it('parent of / is null', async () => {
    const body = (await (await get('/')).json()) as DirListing
    expect(body.path).toBe('/')
    expect(body.parent).toBeNull()
  })
})
