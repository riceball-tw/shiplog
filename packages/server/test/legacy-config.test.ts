import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { configPath, defaultConfig, loadConfig } from '../src/config.js'

describe('legacy ~/.one-on-one config', () => {
  const home = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'ooo-home-')))
  const saved = { HOME: process.env.HOME, SHIPLOG_HOME: process.env.SHIPLOG_HOME }
  afterAll(() => {
    process.env.HOME = saved.HOME
    if (saved.SHIPLOG_HOME === undefined) delete process.env.SHIPLOG_HOME
    else process.env.SHIPLOG_HOME = saved.SHIPLOG_HOME
  })

  it('is copied to ~/.shiplog when no shiplog config exists', async () => {
    process.env.HOME = home
    delete process.env.SHIPLOG_HOME
    mkdirSync(path.join(home, '.one-on-one'))
    const legacy = { ...defaultConfig(), authorEmails: ['legacy@example.com'], meetings: ['2026-01-31'] }
    writeFileSync(path.join(home, '.one-on-one', 'config.json'), JSON.stringify(legacy))

    expect(configPath()).toBe(path.join(home, '.shiplog', 'config.json'))
    expect((await loadConfig()).authorEmails).toEqual(['legacy@example.com'])
    const migrated = JSON.parse(readFileSync(configPath(), 'utf8'))
    expect(migrated.authorEmails).toEqual(['legacy@example.com'])
    expect(migrated).not.toHaveProperty('meetings')
    // old file is left alone
    expect(JSON.parse(readFileSync(path.join(home, '.one-on-one', 'config.json'), 'utf8')).meetings).toEqual(['2026-01-31'])
  })
})
