import type { Commit, CommitType, Theme } from '@shiplog/shared'
import { ymd } from './dates'

export const TYPE_ORDER: CommitType[] = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'revert', 'build', 'ci', 'chore', 'style', 'other']
export const NOISE_TYPES: ReadonlySet<CommitType> = new Set<CommitType>(['chore', 'ci', 'style', 'build'])
export const TYPE_LABELS: Record<CommitType, string> = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  test: 'Tests',
  docs: 'Docs',
  revert: 'Reverts',
  build: 'Build',
  ci: 'CI',
  chore: 'Chores',
  style: 'Style',
  other: 'Other',
}

/** A commit with its cleaned subject, as used by every grouping. */
export interface Item {
  commit: Commit
  ts: number
  /** subject without the Conventional Commit prefix and ticket keys */
  title: string
}

export interface TypeGroup {
  type: CommitType
  items: Item[]
}

export interface ScopeGroup {
  scope: string | null
  items: Item[]
}

export interface TicketGroup {
  /** ticket key; null = the "No ticket" bucket */
  key: string | null
  title: string
  items: Item[]
  first: number
  last: number
  repoIds: string[]
  types: CommitType[]
  /** only for the no-ticket bucket: sub-groups by CC scope (unscoped = null, last) */
  scopes?: ScopeGroup[]
}

export interface RepoSummary {
  repoId: string
  commits: number
  insertions: number
  deletions: number
  byType: TypeGroup[]
  byTicket: TicketGroup[]
}

export interface Summary {
  totals: {
    commits: number
    repos: number
    insertions: number
    deletions: number
    activeDays: number
    noiseHidden: number
  }
  byRepo: RepoSummary[]
  byType: TypeGroup[]
  byTicket: TicketGroup[]
  /** all items kept after the noise filter, newest first as given */
  items: Item[]
}

/** One theme with the work it owns in the current range. */
export interface ThemeCardData {
  theme: Theme
  items: Item[]
  /** starred items, oldest first */
  highlights: Item[]
  tickets: TicketGroup[]
  first: number
  last: number
  repoIds: string[]
}

export interface ThemeGrouping {
  /** themes with work in range, in theme order */
  cards: ThemeCardData[]
  /** themes with no work in range, in theme order */
  empty: Theme[]
  /** ticket groups (and no-ticket commits split by repo) not in any theme */
  unassigned: TicketGroup[]
}

// ---------- subject cleaning ----------

const CC_PREFIX = /^\s*\w+(?:\([^)]*\))?!?\s*[:：]\s*/
const EDGE_PUNCT = /^[\s:：\-–—,，;；|/·.]+|[\s:：\-–—,，;；|/·]+$/g
const EMPTY_BRACKETS = /\[\s*\]|\(\s*\)|【\s*】|（\s*）|<\s*>|\{\s*\}/g

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Strip `type(scope)!: `, the ticket keys, and the punctuation left around them. */
export function cleanSubject(subject: string, tickets: string[] = []): string {
  let s = subject.replace(CC_PREFIX, '')
  for (const t of tickets) s = s.replace(new RegExp(escapeRe(t), 'gi'), '')
  s = s.replace(EMPTY_BRACKETS, '').replace(/\s{2,}/g, ' ').replace(EDGE_PUNCT, '')
  if (s) return s
  // nothing left (e.g. "feat: DS-1") — fall back to the subject minus prefix
  return subject.replace(CC_PREFIX, '').trim() || subject.trim()
}

// ---------- helpers ----------

const typeIndex = (t: CommitType) => TYPE_ORDER.indexOf(t)
const sortTypes = (ts: Iterable<CommitType>) => [...new Set(ts)].sort((a, b) => typeIndex(a) - typeIndex(b))

function groupByType(items: Item[]): TypeGroup[] {
  const m = new Map<CommitType, Item[]>()
  for (const it of items) {
    const t = it.commit.classification.type
    const arr = m.get(t)
    if (arr) arr.push(it)
    else m.set(t, [it])
  }
  return TYPE_ORDER.filter((t) => m.has(t)).map((type) => ({ type, items: m.get(type)! }))
}

// reverts and git-generated "other" subjects (merges, reapplies) make poor titles
const TITLE_SKIP_TYPES: ReadonlySet<CommitType> = new Set(['revert', 'other'])

/** most common title, preferring real work over reverts/merges; ties go to the earliest commit */
function deriveTitle(items: Item[]): string {
  const preferred = items.filter((it) => !TITLE_SKIP_TYPES.has(it.commit.classification.type))
  const counts = new Map<string, { n: number; ts: number }>()
  for (const it of preferred.length ? preferred : items) {
    const e = counts.get(it.title)
    if (e) {
      e.n++
      e.ts = Math.min(e.ts, it.ts)
    } else counts.set(it.title, { n: 1, ts: it.ts })
  }
  let best = ''
  let bn = 0
  let bts = Infinity
  for (const [title, { n, ts }] of counts) {
    if (n > bn || (n === bn && ts < bts)) {
      best = title
      bn = n
      bts = ts
    }
  }
  return best
}

export function makeGroup(key: string | null, items: Item[]): TicketGroup {
  const ts = items.map((i) => i.ts)
  return {
    key,
    title: deriveTitle(items),
    items: [...items].sort((a, b) => a.ts - b.ts),
    first: Math.min(...ts),
    last: Math.max(...ts),
    repoIds: [...new Set(items.map((i) => i.commit.repoId))],
    types: sortTypes(items.map((i) => i.commit.classification.type)),
  }
}

export function groupByTicket(items: Item[]): TicketGroup[] {
  const m = new Map<string, Item[]>()
  const none: Item[] = []
  for (const it of items) {
    if (!it.commit.tickets.length) none.push(it)
    for (const t of it.commit.tickets) {
      const arr = m.get(t)
      if (arr) arr.push(it)
      else m.set(t, [it])
    }
  }
  const out = [...m].map(([k, v]) => makeGroup(k, v)).sort((a, b) => b.items.length - a.items.length || b.last - a.last || a.key!.localeCompare(b.key!))
  if (none.length) {
    const g = makeGroup(null, none)
    const sm = new Map<string | null, Item[]>()
    for (const it of g.items) {
      const scope = it.commit.classification.scope || null
      const arr = sm.get(scope)
      if (arr) arr.push(it)
      else sm.set(scope, [it])
    }
    g.scopes = [...sm]
      .map(([scope, its]) => ({ scope, items: its }))
      .sort((a, b) => (a.scope === null ? 1 : 0) - (b.scope === null ? 1 : 0) || b.items.length - a.items.length || (a.scope ?? '').localeCompare(b.scope ?? ''))
    out.push(g)
  }
  return out
}

// ---------- summarize ----------

export function summarize(commits: Commit[], opts: { hideNoise: boolean }): Summary {
  const all: Item[] = commits.map((commit) => ({
    commit,
    ts: Date.parse(commit.date),
    title: cleanSubject(commit.subject, commit.tickets),
  }))
  const kept = opts.hideNoise ? all.filter((i) => !NOISE_TYPES.has(i.commit.classification.type)) : all

  const days = new Set<string>()
  let insertions = 0
  let deletions = 0
  for (const { commit, ts } of all) {
    insertions += commit.insertions
    deletions += commit.deletions
    days.add(ymd(ts))
  }

  const byRepoMap = new Map<string, Item[]>()
  for (const it of kept) {
    const arr = byRepoMap.get(it.commit.repoId)
    if (arr) arr.push(it)
    else byRepoMap.set(it.commit.repoId, [it])
  }
  const byRepo: RepoSummary[] = [...byRepoMap]
    .map(([repoId, items]) => ({
      repoId,
      commits: items.length,
      insertions: items.reduce((n, i) => n + i.commit.insertions, 0),
      deletions: items.reduce((n, i) => n + i.commit.deletions, 0),
      byType: groupByType(items),
      byTicket: groupByTicket(items),
    }))
    .sort((a, b) => b.commits - a.commits || a.repoId.localeCompare(b.repoId))

  return {
    totals: {
      commits: all.length,
      repos: new Set(all.map((i) => i.commit.repoId)).size,
      insertions,
      deletions,
      activeDays: days.size,
      noiseHidden: all.length - kept.length,
    },
    byRepo,
    byType: groupByType(kept),
    byTicket: groupByTicket(kept),
    items: kept,
  }
}

// ---------- markdown ----------

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const MAX_BULLETS = 15

/** Bullet lines for ticket groups; the no-ticket bucket is split by CC scope. */
function ticketLines(groups: TicketGroup[]): string[] {
  const out: string[] = []
  for (const g of groups) {
    if (g.key !== null) out.push(`- **${g.key}** ${g.title} — ${plural(g.items.length, 'commit')}, ${g.types.join('/')}`)
    else
      for (const s of g.scopes ?? [{ scope: null, items: g.items }]) {
        const types = sortTypes(s.items.map((i) => i.commit.classification.type)).join('/')
        out.push(`- **No ticket${s.scope ? ` · ${s.scope}` : ''}** ${deriveTitle(s.items)} — ${plural(s.items.length, 'commit')}, ${types}`)
      }
  }
  return out
}

const MAX_OTHER = 10

function themesMarkdown(rangeLabel: string, themes: ThemeGrouping): string {
  const out: string[] = [`## ${rangeLabel}`]
  for (const card of themes.cards) {
    out.push('', `### ${card.theme.name.trim() || 'Untitled theme'}`, '', card.theme.outcome.trim() || '_(no outcome written yet)_', '')
    for (const it of card.highlights) {
      const t = it.commit.tickets.length ? ` (${it.commit.tickets.join(', ')})` : ''
      out.push(`- ★ ${it.title}${t}`)
    }
    out.push(...ticketLines(card.tickets))
  }
  const other = themes.unassigned.flatMap((g) => ticketLines([g]))
  if (other.length) {
    out.push('', '### Other work', '', ...other.slice(0, MAX_OTHER))
    if (other.length > MAX_OTHER) out.push(`- …and ${other.length - MAX_OTHER} more`)
  }
  return out.join('\n') + '\n'
}

export function toMarkdown(
  summary: Summary,
  opts: { rangeLabel: string; groupBy: 'theme' | 'ticket' | 'type'; repoNames: Record<string, string>; themes?: ThemeGrouping },
): string {
  if (opts.groupBy === 'theme' && opts.themes) return themesMarkdown(opts.rangeLabel, opts.themes)
  const { totals } = summary
  const out: string[] = [`## ${opts.rangeLabel} · ${plural(totals.commits, 'commit')} · ${plural(totals.repos, 'repo')}`]
  if (totals.noiseHidden) out.push('', `_${plural(totals.noiseHidden, 'noise commit')} (chore/ci/style/build) not listed_`)

  for (const repo of summary.byRepo) {
    out.push('', `### ${opts.repoNames[repo.repoId] ?? repo.repoId}`, '')
    if (opts.groupBy === 'ticket') {
      out.push(...ticketLines(repo.byTicket))
    } else {
      repo.byType.forEach((g, i) => {
        if (i) out.push('')
        out.push(`**${TYPE_LABELS[g.type]} (${g.items.length})**`, '')
        const sorted = [...g.items].sort((a, b) => a.ts - b.ts)
        for (const it of sorted.slice(0, MAX_BULLETS)) {
          const t = it.commit.tickets.length ? ` (${it.commit.tickets.join(', ')})` : ''
          out.push(`- ${it.title}${t}`)
        }
        if (sorted.length > MAX_BULLETS) out.push(`- …and ${sorted.length - MAX_BULLETS} more`)
      })
    }
  }
  return out.join('\n') + '\n'
}
