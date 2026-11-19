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
  /** dates of past 1:1 meetings (YYYY-MM-DD) */
  meetings: string[]
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
// GET  /api/repos                          -> Repo[]
// GET  /api/authors?repoId=                -> AuthorInfo[]  (all authors seen, to help pick identities)
// POST /api/scan                           -> ScanResult
// GET  /api/commits?from=&to=&repos=a,b    -> Commit[]  (from/to ISO dates, inclusive; repos optional)
// GET  /api/heatmap?from=&to=&repos=       -> HeatmapRow[]

export interface AuthorInfo {
  email: string
  name: string
  commits: number
  /** all distinct display names seen for this email (aggregated /api/authors) */
  names?: string[]
}

/** Body of a 400 response from PUT /api/config */
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
