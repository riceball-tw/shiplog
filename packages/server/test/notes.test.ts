import { mkdtempSync, readdirSync, realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { Notes } from '@shiplog/shared'
import { createApp } from '../src/app.js'
import { notesPath } from '../src/notes.js'
import { MemoryCommitStore } from '../src/store.js'

const tmp = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ooo-notes-')))
const theme = (id: string, over: Record<string, unknown> = {}) => ({ id, name: 'Payments', outcome: '', tickets: [], commits: [], repoIds: [], ...over })

describe('/api/notes', () => {
  const { app } = createApp({ store: new MemoryCommitStore(), allowMissingHost: true })
  const put = (body: unknown) =>
    app.request('/api/notes', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })

  beforeAll(() => {
    process.env.SHIPLOG_HOME = path.join(tmp, 'home')
  })

  it('returns empty notes when the file is missing', async () => {
    const res = await app.request('/api/notes')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ themes: [], highlights: [] })
  })

  it('saves, round-trips and leaves no tmp file', async () => {
    const notes: Notes = { themes: [theme('a', { outcome: 'cut p95', tickets: ['DS-1'], commits: ['r1:abc'], repoIds: ['r2'] })], highlights: ['r1:abc'] }
    const res = await put(notes)
    expect(res.status).toBe(200)
    expect(await (await app.request('/api/notes')).json()).toEqual(notes)
    expect(readdirSync(path.dirname(notesPath()))).toEqual(['notes.json'])
  })

  const cases: [string, unknown, string][] = [
    ['not JSON', '{nope', 'valid JSON'],
    ['not an object', [], 'JSON object'],
    ['themes missing', { highlights: [] }, 'themes must be an array'],
    ['highlights missing', { themes: [] }, 'highlights'],
    ['theme without id', { themes: [theme('')], highlights: [] }, 'id'],
    ['duplicate ids', { themes: [theme('a'), theme('a')], highlights: [] }, 'duplicated'],
    ['too many themes', { themes: Array.from({ length: 51 }, (_, i) => theme('t' + i)), highlights: [] }, 'at most 50'],
    ['name too long', { themes: [theme('a', { name: 'x'.repeat(201) })], highlights: [] }, 'name'],
    ['outcome too long', { themes: [theme('a', { outcome: 'x'.repeat(2001) })], highlights: [] }, 'outcome'],
    ['tickets not strings', { themes: [theme('a', { tickets: [1] })], highlights: [] }, 'tickets'],
  ]
  for (const [name, body, needle] of cases) {
    it(`rejects ${name} with 400`, async () => {
      const res = await put(body)
      expect(res.status).toBe(400)
      const json = (await res.json()) as { error: string; details: string[] }
      expect(json.error).toBe('invalid notes')
      expect(json.details.join('\n')).toContain(needle)
    })
  }
})
