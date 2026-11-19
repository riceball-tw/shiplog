import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { AppConfig, AuthorInfo, Repo, ScanResult } from '@one-on-one/shared'
import { loadConfig, saveConfig } from './config.js'
import { discoverRepos } from './discovery.js'
import { readAuthors } from './gitlog.js'
import { scan } from './scan.js'
import type { CommitStore } from './store.js'

export interface AppOptions {
  store: CommitStore
  /** directory with the built web app; served when it exists */
  webDist?: string
}

export function createApp({ store, webDist }: AppOptions) {
  const app = new Hono()
  let repos: Repo[] | null = null
  let scanning: Promise<ScanResult> | null = null

  const getRepos = async () => (repos ??= await discoverRepos(await loadConfig()))

  const runScan = () =>
    (scanning ??= (async () => {
      try {
        const { repoList, ...result } = await scan(await loadConfig(), store)
        repos = repoList
        return result
      } finally {
        scanning = null
      }
    })())

  const list = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : undefined)
  const rangeQuery = (q: (k: string) => string | undefined) => ({
    from: q('from') || undefined,
    to: q('to') || undefined,
    repoIds: list(q('repos')),
  })

  app.get('/api/health', (c) => c.json({ ok: true }))
  app.get('/api/config', async (c) => c.json(await loadConfig()))
  app.put('/api/config', async (c) => {
    const saved = await saveConfig((await c.req.json()) as AppConfig)
    repos = null
    return c.json(saved)
  })
  app.get('/api/repos', async (c) => c.json(await getRepos()))
  app.get('/api/authors', async (c) => {
    const all = await getRepos()
    const id = c.req.query('repoId')
    const targets = id ? all.filter((r) => r.id === id) : all
    const merged = new Map<string, AuthorInfo>()
    for (const repo of targets) {
      let authors: AuthorInfo[] = []
      try {
        authors = await readAuthors(repo.path)
      } catch {
        continue
      }
      for (const a of authors) {
        const prev = merged.get(a.email.toLowerCase())
        if (prev) {
          prev.commits += a.commits
          if (a.name && !prev.names!.includes(a.name)) prev.names!.push(a.name)
        } else merged.set(a.email.toLowerCase(), { ...a, names: a.name ? [a.name] : [] })
      }
    }
    return c.json([...merged.values()].sort((a, b) => b.commits - a.commits))
  })
  app.post('/api/scan', async (c) => c.json(await runScan()))
  app.get('/api/commits', (c) => c.json(store.query(rangeQuery((k) => c.req.query(k)))))
  app.get('/api/heatmap', (c) => c.json(store.heatmap(rangeQuery((k) => c.req.query(k)))))
  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404))

  if (webDist && existsSync(path.join(webDist, 'index.html'))) {
    const index = readFileSync(path.join(webDist, 'index.html'), 'utf8')
    app.use('/*', serveStatic({ root: path.relative(process.cwd(), webDist) }))
    app.get('*', (c) => c.html(index))
  }

  return { app, runScan }
}
