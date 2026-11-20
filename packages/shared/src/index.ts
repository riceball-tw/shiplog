// Shared contracts between server and web. Keep this file the single source of truth.

export type CommitType =
  | 'feat'
  | 'fix'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'docs'
  | 'ci'
  | 'build'
  | 'chore'
  | 'style'
  | 'revert'
  | 'other'

/** high = parsed from a Conventional Commit header; low = guessed by heuristic */
export type Confidence = 'high' | 'low'

export interface Classification {
  type: CommitType
  scope: string | null
  breaking: boolean
  confidence: Confidence
}

export interface FileChange {
  path: string
  insertions: number
  deletions: number
  /** true when matched by config.excludeFromStats (lockfiles, generated code) */
  excluded: boolean
}

export interface Repo {
  /** stable id: sha1 of absolute path, first 12 hex chars */
  id: string
  name: string
  path: string
  included: boolean
}

export interface Commit {
  hash: string
  repoId: string
  /** ISO 8601 author date */
  date: string
  authorEmail: string
  authorName: string
  subject: string
  body: string
  /** decorations from %D, e.g. ["HEAD -> main", "tag: v1.0"] */
  refs: string[]
  files: FileChange[]
  /** totals excluding files with excluded=true */
  insertions: number
  deletions: number
  classification: Classification
  /** e.g. ["ABC-123"] */
  tickets: string[]
  /** MR/PR references parsed from message, e.g. ["!42", "#17"] */
  mergeRequests: string[]
}

export interface AppConfig {
  /** directories to scan recursively for git repos (~ allowed) */
  scanRoots: string[]
  /** extra repo paths always included */
  pinnedRepos: string[]
  /** repo paths explicitly excluded */
  excludedRepos: string[]
  /** emails that identify the user (case-insensitive) */
  authorEmails: string[]
  /** max directory depth when scanning roots */
  scanDepth: number
  /** dir names skipped while scanning */
  ignoreDirs: string[]
  /** globs excluded from line stats */
  excludeFromStats: string[]
  /** only read history newer than this (ISO date or git --since string like "12 months ago") */
  since: string
  classifier: {
    /** extra keyword → type rules, regex source strings, checked before built-ins */
    keywords: Partial<Record<CommitType, string[]>>
  }
}

export interface ScanResult {
  repos: number
  newCommits: number
  durationMs: number
  errors: { repoPath: string; message: string }[]
}

// ---- API (all under /api) ----
// GET  /api/health                         -> { ok: true }
// GET  /api/config                         -> AppConfig
// PUT  /api/config        body AppConfig   -> AppConfig
// GET  /api/notes                          -> Notes  (themes + highlights; notes.json next to config.json; empty when missing)
// PUT  /api/notes         body Notes       -> Notes  (400 NotesError on invalid shape: <=50 themes, unique ids, sane lengths)
// GET  /api/repos                          -> Repo[]
// GET  /api/authors?repoId=                -> AuthorInfo[]  (all authors seen, to help pick identities)
// POST /api/scan                           -> ScanResult
// GET  /api/commits?from=&to=&repos=a,b    -> Commit[]  (from/to ISO dates, inclusive; repos optional)
// GET  /api/heatmap?from=&to=&repos=       -> HeatmapRow[]
// GET  /api/fs/list?path=<abs or ~>        -> DirListing  (subfolders only; default home; 404 missing, 403 unreadable, 400 not a dir; body { error })
// All /api/* requests must carry a loopback Host header (127.0.0.1 / localhost, any port), else 403.

export interface AuthorInfo {
  email: string
  name: string
  commits: number
  /** all distinct display names seen for this email (aggregated /api/authors) */
  names?: string[]
}

/** Body of a 400 response from PUT /api/config and PUT /api/notes */
export interface ConfigError {
  error: string
  details: string[]
}

export interface HeatmapRow {
  /** YYYY-MM-DD (local time) */
  day: string
  repoId: string
  commits: number
}

export interface DirEntry {
  name: string
  /** absolute path */
  path: string
  /** contains a .git dir or file */
  isGitRepo: boolean
}

export interface DirListing {
  /** absolute, resolved path that was listed */
  path: string
  /** null at filesystem root */
  parent: string | null
  home: string
  /** subdirectories only, hidden ones omitted, case-insensitively sorted, capped at 2000 */
  entries: DirEntry[]
}

/** Stable per-commit key used for notes (highlights, theme commits) and UI selection. */
export const commitKey = (c: { repoId: string; hash: string }) => `${c.repoId}:${c.hash}`

/** A review theme: a named story with a written outcome, backed by tickets/commits/repos. */
export interface Theme {
  id: string
  name: string
  /** one line: what changed because of this work */
  outcome: string
  tickets: string[]
  /** commit keys (repoId:hash) */
  commits: string[]
  repoIds: string[]
}

export interface Notes {
  themes: Theme[]
  /** starred commit keys */
  highlights: string[]
}
