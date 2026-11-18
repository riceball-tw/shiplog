import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { AppConfig } from '@one-on-one/shared'

const run = promisify(execFile)

export function homeDir(): string {
  return process.env.ONE_ON_ONE_HOME ?? path.join(os.homedir(), '.one-on-one')
}

export function configPath(): string {
  return path.join(homeDir(), 'config.json')
}

export function expandHome(p: string): string {
  if (p === '~') return os.homedir()
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2))
  return p
}

export function defaultConfig(): AppConfig {
  return {
    scanRoots: [],
    pinnedRepos: [],
    excludedRepos: [],
    authorEmails: [],
    scanDepth: 5,
    ignoreDirs: ['node_modules', 'vendor', '.cache', 'dist', 'build', '.venv', 'Pods'],
    excludeFromStats: [
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/yarn.lock',
      '**/*.lock',
      '**/*.min.js',
      '**/dist/**',
      '**/*.snap',
      '**/go.sum',
    ],
    since: '12 months ago',
    meetings: [],
    classifier: { keywords: {} },
  }
}

async function globalGitEmail(): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['config', '--global', 'user.email'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

/** Fill gaps in a partial config with defaults and expand `~` in paths. */
export function normalizeConfig(raw: Partial<AppConfig>): AppConfig {
  const d = defaultConfig()
  const paths = (list: string[] | undefined) => (list ?? []).map(expandHome)
  return {
    scanRoots: paths(raw.scanRoots),
    pinnedRepos: paths(raw.pinnedRepos),
    excludedRepos: paths(raw.excludedRepos),
    authorEmails: raw.authorEmails ?? d.authorEmails,
    scanDepth: raw.scanDepth ?? d.scanDepth,
    ignoreDirs: raw.ignoreDirs ?? d.ignoreDirs,
    excludeFromStats: raw.excludeFromStats ?? d.excludeFromStats,
    since: raw.since ?? d.since,
    meetings: raw.meetings ?? d.meetings,
    classifier: { keywords: raw.classifier?.keywords ?? {} },
  }
}

export async function saveConfig(config: AppConfig): Promise<AppConfig> {
  const normalized = normalizeConfig(config)
  await fs.mkdir(homeDir(), { recursive: true })
  await fs.writeFile(configPath(), JSON.stringify(normalized, null, 2) + '\n')
  return normalized
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await fs.readFile(configPath(), 'utf8')) as Partial<AppConfig>
    return normalizeConfig(raw)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  const config = defaultConfig()
  const email = await globalGitEmail()
  if (email) config.authorEmails = [email]
  return saveConfig(config)
}
