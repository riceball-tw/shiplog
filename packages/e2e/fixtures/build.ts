import { execFileSync } from 'node:child_process'
import { mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { COMMITS, ME } from './data.js'

/** Env that keeps git deterministic and blind to the developer's own config. */
function gitEnv(when: Date, email: string): NodeJS.ProcessEnv {
  const iso = when.toISOString()
  return {
    PATH: process.env.PATH,
    HOME: os.tmpdir(),
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: email === ME ? 'E2E User' : 'Someone Else',
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: email === ME ? 'E2E User' : 'Someone Else',
    GIT_COMMITTER_EMAIL: email,
    GIT_AUTHOR_DATE: iso,
    GIT_COMMITTER_DATE: iso,
  }
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv) {
  execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], { cwd, env, stdio: 'pipe' })
}

export interface Fixture {
  /** temp root holding `projects/` (scan root) and `home/` (SHIPLOG_HOME) */
  root: string
  home: string
}

/**
 * Fresh temp dir with the repos from data.ts and a config.json pointing at them.
 * The path is fixed (and wiped first) so a run killed with SIGKILL can't leave a pile of stale dirs.
 */
export function buildFixture(): Fixture {
  const dir = path.join(realpathSync(os.tmpdir()), 'shiplog-e2e')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const root = dir
  const projects = path.join(root, 'projects')
  const home = path.join(root, 'home')
  mkdirSync(home, { recursive: true })

  const repos = [...new Set(COMMITS.map((c) => c.repo))]
  for (const name of repos) {
    const dir = path.join(projects, name)
    mkdirSync(dir, { recursive: true })
    git(dir, ['init', '-q', '-b', 'main'], gitEnv(new Date(), ME))
  }
  // oldest first so history is linear and stable
  const ordered = COMMITS.map((c, i) => ({ c, i })).sort((a, b) => b.c.daysAgo - a.c.daysAgo || a.i - b.i)
  for (const { c, i } of ordered) {
    const when = new Date()
    when.setDate(when.getDate() - c.daysAgo)
    when.setHours(12, 0, 0, 0)
    const dir = path.join(projects, c.repo)
    const env = gitEnv(when, c.author ?? ME)
    writeFileSync(path.join(dir, `file-${i}.ts`), `export const n = ${i}\n`)
    git(dir, ['add', '-A'], env)
    git(dir, ['commit', '-q', '-m', c.subject], env)
  }

  writeFileSync(
    path.join(home, 'config.json'),
    JSON.stringify({ scanRoots: [projects], authorEmails: [ME], since: '12 months ago' }, null, 2) + '\n',
  )
  return { root, home }
}
