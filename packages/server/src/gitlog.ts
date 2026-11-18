import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import picomatch from 'picomatch'
import type { AuthorInfo, Commit, FileChange } from '@one-on-one/shared'
import { classify, parseRefs } from './classify.js'

const run = promisify(execFile)
const MAX_BUFFER = 1024 * 1024 * 1024

export const LOG_FORMAT = '%x1e%H%x1f%aI%x1f%ae%x1f%an%x1f%s%x1f%b%x1f%D%x1f'

/** Normalize numstat rename notations (`a => b`, `dir/{x => y}/f`) to the new path. */
export function normalizePath(p: string): string {
  const brace = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(p)
  if (brace) return `${brace[1]}${brace[3]}${brace[4]}`.replace(/\/{2,}/g, '/')
  const arrow = p.indexOf(' => ')
  return arrow >= 0 ? p.slice(arrow + 4) : p
}

export function parseNumstat(text: string): { path: string; insertions: number; deletions: number }[] {
  const out: { path: string; insertions: number; deletions: number }[] = []
  for (const line of text.split('\n')) {
    const m = /^(-|\d+)\t(-|\d+)\t(.+)$/.exec(line)
    if (!m) continue
    out.push({
      path: normalizePath(m[3]!),
      insertions: m[1] === '-' ? 0 : Number(m[1]),
      deletions: m[2] === '-' ? 0 : Number(m[2]),
    })
  }
  return out
}

export interface ParseOptions {
  repoId: string
  authorEmails: string[]
  excludeFromStats: string[]
  keywords?: Parameters<typeof classify>[2]
}

export function parseGitLog(output: string, opts: ParseOptions): Commit[] {
  const emails = new Set(opts.authorEmails.map((e) => e.toLowerCase()))
  const isExcluded = opts.excludeFromStats.length
    ? picomatch(opts.excludeFromStats, { dot: true })
    : () => false
  const commits: Commit[] = []

  for (const record of output.split('\x1e')) {
    if (!record.trim()) continue
    const [hash, date, authorEmail, authorName, subject, body, refs, numstat] = record.split('\x1f')
    if (!hash || !date || authorEmail === undefined || !emails.has(authorEmail.toLowerCase())) continue

    const files: FileChange[] = parseNumstat(numstat ?? '').map((f) => ({
      ...f,
      excluded: isExcluded(f.path),
    }))
    const counted = files.filter((f) => !f.excluded)
    const cleanBody = (body ?? '').trim()
    const cleanSubject = subject ?? ''
    commits.push({
      hash: hash.trim(),
      repoId: opts.repoId,
      date,
      authorEmail,
      authorName: authorName ?? '',
      subject: cleanSubject,
      body: cleanBody,
      refs: (refs ?? '').split(',').map((r) => r.trim()).filter(Boolean),
      files,
      insertions: counted.reduce((s, f) => s + f.insertions, 0),
      deletions: counted.reduce((s, f) => s + f.deletions, 0),
      classification: classify(cleanSubject, files.map((f) => f.path), opts.keywords, cleanBody),
      ...parseRefs(`${cleanSubject}\n${cleanBody}`),
    })
  }
  return commits
}

export async function readCommits(repoPath: string, since: string, opts: Omit<ParseOptions, 'repoId'> & { repoId: string }): Promise<Commit[]> {
  const { stdout } = await run(
    'git',
    ['log', '--exclude=refs/stash', '--all', '--no-merges', '--date=iso-strict', '--numstat', `--since=${since}`, `--pretty=format:${LOG_FORMAT}`],
    { cwd: repoPath, maxBuffer: MAX_BUFFER },
  )
  return parseGitLog(stdout, opts)
}

export async function readAuthors(repoPath: string): Promise<AuthorInfo[]> {
  const { stdout } = await run('git', ['log', '--exclude=refs/stash', '--all', '--format=%ae%x1f%an'], {
    cwd: repoPath,
    maxBuffer: MAX_BUFFER,
  })
  const map = new Map<string, AuthorInfo>()
  for (const line of stdout.split('\n')) {
    const [email, name] = line.split('\x1f')
    if (!email) continue
    const key = email.toLowerCase()
    const a = map.get(key)
    if (a) a.commits++
    else map.set(key, { email, name: name ?? '', commits: 1 })
  }
  return [...map.values()]
}
