import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { DirEntry, DirListing } from '@one-on-one/shared'
import { expandHome } from './config.js'

const MAX_ENTRIES = 2000

export class FsListError extends Error {
  constructor(message: string, public status: 400 | 403 | 404) {
    super(message)
  }
}

async function hasGit(dir: string): Promise<boolean> {
  try {
    await fs.stat(path.join(dir, '.git'))
    return true
  } catch {
    return false
  }
}

/** List subdirectories of `raw` (absolute or ~ path; default home). Hidden dirs are skipped. */
export async function listDir(raw: string | undefined): Promise<DirListing> {
  const home = os.homedir()
  const input = raw?.trim() || home
  const expanded = expandHome(input)
  if (!path.isAbsolute(expanded)) throw new FsListError('path must be absolute or start with ~', 400)
  const dir = path.resolve(expanded)

  let dirents
  try {
    if (!(await fs.stat(dir)).isDirectory()) throw new FsListError('not a directory', 400)
    dirents = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err instanceof FsListError) throw err
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') throw new FsListError('path does not exist', 404)
    if (code === 'EACCES' || code === 'EPERM') throw new FsListError('permission denied', 403)
    if (code === 'ENOTDIR') throw new FsListError('not a directory', 400)
    throw new FsListError((err as Error).message, 400)
  }

  const subdirs: { name: string; path: string }[] = []
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue
    const p = path.join(dir, d.name)
    if (d.isDirectory()) subdirs.push({ name: d.name, path: p })
    else if (d.isSymbolicLink()) {
      try {
        if ((await fs.stat(p)).isDirectory()) subdirs.push({ name: d.name, path: p })
      } catch {
        // broken symlink
      }
    }
  }
  subdirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const entries: DirEntry[] = await Promise.all(
    subdirs.slice(0, MAX_ENTRIES).map(async (s) => ({ ...s, isGitRepo: await hasGit(s.path) })),
  )
  const parent = path.dirname(dir)
  return { path: dir, parent: parent === dir ? null : parent, home, entries }
}
