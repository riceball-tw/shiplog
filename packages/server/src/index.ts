import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { configPath } from './config.js'
import { MemoryCommitStore } from './store.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT ?? 4317)

const { app, runScan } = createApp({
  store: new MemoryCommitStore(),
  webDist: path.resolve(here, '../../web/dist'),
})

serve({ fetch: app.fetch, hostname: '127.0.0.1', port }, (info) => {
  console.log(`one-on-one server listening on http://127.0.0.1:${info.port}`)
  console.log(`config: ${configPath()}`)
  runScan()
    .then((r) => console.log(`initial scan: ${r.repos} repos, ${r.newCommits} commits, ${r.errors.length} errors`))
    .catch((err) => console.error('initial scan failed', err))
})
