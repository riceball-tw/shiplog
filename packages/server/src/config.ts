import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { AppConfig } from '@shiplog/shared'

const run = promisify(execFile)

export function homeDir(): string {
  return process.env.SHIPLOG_HOME ?? path.join(os.homedir(), '.shiplog')
}

export function configPath(): string {
  return path.join(homeDir(), 'config.json')
}

/**
 * The app used to be called one-on-one and kept its config in ~/.one-on-one. When the default
 * home has no config yet, carry that one over (the old file is left in place).
 */
async function readLegacyConfig(): Promise<AppConfig | null> {
  if (process.env.SHIPLOG_HOME) return null
  try {
    const raw = await fs.readFile(path.join(os.homedir(), '.one-on-one', 'config.json'), 'utf8')
    return normalizeConfig(JSON.parse(raw) as Partial<AppConfig>)
  } catch {
    return null
  }
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
  const legacy = await readLegacyConfig()
  if (legacy) return saveConfig(legacy)
  const config = defaultConfig()
  const email = await globalGitEmail()
  if (email) config.authorEmails = [email]
  return saveConfig(config)
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function isDir(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isDirectory()
  } catch {
    return false
  }
}

/** Returns human-readable problems; empty array means the config is valid. */
export async function validateConfig(raw: unknown): Promise<string[]> {
  const errs: string[] = []
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['body must be a JSON object']
  const c = raw as Record<string, unknown>
  const strList = (k: string): string[] | null => {
    const v = c[k]
    if (v === undefined) return []
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
      errs.push(`${k} must be an array of strings`)
      return null
    }
    return v as string[]
  }
  for (const k of ['scanRoots', 'pinnedRepos'] as const) {
    for (const p of strList(k) ?? []) {
      if (!(await isDir(path.resolve(expandHome(p))))) errs.push(`${k}: "${p}" does not exist or is not a directory`)
    }
  }
  strList('excludedRepos')
  strList('ignoreDirs')
  strList('excludeFromStats')
  for (const e of strList('authorEmails') ?? []) if (!EMAIL_RE.test(e)) errs.push(`authorEmails: "${e}" is not a valid email`)
  if (c.scanDepth !== undefined && (!Number.isInteger(c.scanDepth) || (c.scanDepth as number) < 1 || (c.scanDepth as number) > 10))
    errs.push('scanDepth must be an integer between 1 and 10')
  if (c.since !== undefined && (typeof c.since !== 'string' || !c.since.trim())) errs.push('since must be a non-empty string')
  const kw = (c.classifier as { keywords?: unknown } | undefined)?.keywords
  if (kw !== undefined) {
    if (!kw || typeof kw !== 'object' || Array.isArray(kw)) errs.push('classifier.keywords must be an object')
    else
      for (const [type, list] of Object.entries(kw)) {
        if (!Array.isArray(list) || list.some((x) => typeof x !== 'string')) {
          errs.push(`classifier.keywords.${type} must be an array of strings`)
          continue
        }
        for (const src of list as string[]) {
          try {
            new RegExp(src, 'i')
          } catch (e) {
            errs.push(`classifier.keywords.${type}: invalid regex "${src}" (${(e as Error).message})`)
          }
        }
      }
  }
  return errs
}
