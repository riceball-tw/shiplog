/**
 * webServer entry. Playwright starts `webServer` BEFORE `globalSetup`, so the synthetic repos
 * have to exist before the server does: this script builds them, points SHIPLOG_HOME at the
 * temp home, then loads the production server bundle in-process (one pid for Playwright to kill).
 * The server's initial scan is async; global-setup.ts awaits POST /api/scan so tests start with data.
 */
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildFixture } from './build.js'

const fx = buildFixture()
process.env.SHIPLOG_HOME = fx.home
process.env.PORT ??= '4399'
console.log(`e2e fixture: ${fx.root}`)

const cleanup = () => {
  rmSync(fx.root, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)

await import(fileURLToPath(new URL('../../server/dist/index.js', import.meta.url)))
