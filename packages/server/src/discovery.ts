import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { AppConfig, Repo } from '@one-on-one/shared'

export function repoId(absPath: string): string {
  return createHash('sha1').update(absPath).digest('hex').slice(0, 12)
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function walk(dir: string, depth: number, config: AppConfig, found: Set<string>): Promise<void> {
  if (await exists(path.join(dir, '.git'))) {
    found.add(dir)
    return
  }
  if (depth <= 0) return
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return // unreadable directory
  }
  const ignore = new Set(config.ignoreDirs)
  const children = entries.filter(
    (e) => e.isDirectory() && !e.name.startsWith('.') && !ignore.has(e.name),
  )
  await Promise.all(children.map((e) => walk(path.join(dir, e.name), depth - 1, config, found)))
}

/** Find git repos under scanRoots, add pinned ones; excluded ones are returned with included=false. */
export async function discoverRepos(config: AppConfig): Promise<Repo[]> {
  const found = new Set<string>()
  for (const root of config.scanRoots) {
    await walk(path.resolve(root), config.scanDepth, config, found)
  }
  for (const pinned of config.pinnedRepos) {
    const abs = path.resolve(pinned)
    if (await exists(path.join(abs, '.git'))) found.add(abs)
  }
  const excluded = new Set(config.excludedRepos.map((p) => path.resolve(p)))
  return [...found]
    .sort()
    .map((p) => ({ id: repoId(p), name: path.basename(p), path: p, included: !excluded.has(p) }))
}
