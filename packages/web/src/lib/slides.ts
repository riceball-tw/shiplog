import { commitKey, type Notes } from '@shiplog/shared'
import type { Range, TimedCommit } from '../stores/app'
import { themeGanttRows, type GanttRow } from './charts'
import { rangeLabel } from './dates'
import { summarize, type TicketGroup } from './summary'
import { groupByTheme } from './themes'

export const MAX_HIGHLIGHTS = 6
export const MAX_TICKETS = 6
export const MAX_OTHER = 8

export interface SlideTicket {
  /** null = commits without a ticket */
  key: string | null
  title: string
  commits: number
}
export interface SlideHighlight {
  title: string
  tickets: string[]
  repoId: string
}

export interface TitleSlide {
  kind: 'title'
  id: string
  label: string
  author: string | null
  themes: number
  tickets: number
  repos: number
  commits: number
}
export interface OverviewSlide {
  kind: 'overview'
  id: string
}
export interface ThemeSlide {
  kind: 'theme'
  id: string
  name: string
  /** trimmed; empty when none is written (hasOutcome = false) */
  outcome: string
  hasOutcome: boolean
  /** palette slot = index in the theme order */
  colorIdx: number
  first: number
  last: number
  commits: number
  repoIds: string[]
  /** the theme's row of the themes timeline, for the strip */
  row: GanttRow
  /** starred commits, oldest first, capped at MAX_HIGHLIGHTS */
  highlights: SlideHighlight[]
  moreHighlights: number
  /** top tickets by commit count, capped at MAX_TICKETS */
  tickets: SlideTicket[]
  moreTickets: number
}
export interface OtherSlide {
  kind: 'other'
  id: string
  commits: number
  tickets: SlideTicket[]
  moreTickets: number
}
export type Slide = TitleSlide | OverviewSlide | ThemeSlide | OtherSlide

export interface SlideInput {
  /** commits in range after the noise filter */
  commits: TimedCommit[]
  notes: Notes
  range: Range
}

/** most frequent author name, or null */
export function authorOf(commits: { authorName: string }[]): string | null {
  const n = new Map<string, number>()
  for (const c of commits) if (c.authorName.trim()) n.set(c.authorName.trim(), (n.get(c.authorName.trim()) ?? 0) + 1)
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
}

const toTicket = (g: TicketGroup): SlideTicket => ({ key: g.key, title: g.title, commits: g.items.length })
const cap = <T>(xs: T[], n: number) => ({ shown: xs.slice(0, n), more: Math.max(0, xs.length - n) })
// stable sort: ties keep the grouping's order
const byCommits = (a: SlideTicket, b: SlideTicket) => b.commits - a.commits

/** Title, overview, one slide per theme with work (theme order), then Other work if any. */
export function buildSlides({ commits, notes, range }: SlideInput): Slide[] {
  const items = summarize(commits, { hideNoise: false }).items
  const grouping = groupByTheme(items, notes)
  const rows = new Map(themeGanttRows(commits, notes.themes, notes.highlights, range).map((r) => [r.id, r]))
  const slides: Slide[] = [
    {
      kind: 'title',
      id: 'title',
      // without the "(N days)" suffix
      label: rangeLabel(range).replace(/\s*\([^)]*\)$/, ''),
      author: authorOf(commits),
      themes: grouping.cards.length,
      tickets: new Set(commits.flatMap((c) => c.tickets)).size,
      repos: new Set(commits.map((c) => c.repoId)).size,
      commits: commits.length,
    },
    { kind: 'overview', id: 'overview' },
  ]
  for (const card of grouping.cards) {
    const outcome = card.theme.outcome.trim()
    const hl = cap(card.highlights.map((it) => ({ title: it.title, tickets: it.commit.tickets, repoId: it.commit.repoId })), MAX_HIGHLIGHTS)
    const tk = cap(card.tickets.filter((g) => g.key !== null).map(toTicket).sort(byCommits), MAX_TICKETS)
    slides.push({
      kind: 'theme',
      id: `theme:${card.theme.id}`,
      name: card.theme.name.trim() || 'Untitled theme',
      outcome,
      hasOutcome: outcome !== '',
      colorIdx: notes.themes.findIndex((t) => t.id === card.theme.id),
      first: card.first,
      last: card.last,
      commits: card.items.length,
      repoIds: card.repoIds,
      row: rows.get(card.theme.id)!,
      highlights: hl.shown,
      moreHighlights: hl.more,
      tickets: tk.shown,
      moreTickets: tk.more,
    })
  }
  if (grouping.unassigned.length) {
    const tk = cap(grouping.unassigned.map(toTicket).sort(byCommits), MAX_OTHER)
    slides.push({
      kind: 'other',
      id: 'other',
      commits: new Set(grouping.unassigned.flatMap((g) => g.items.map((i) => commitKey(i.commit)))).size,
      tickets: tk.shown,
      moreTickets: tk.more,
    })
  }
  return slides
}

/** short spoken label for screen readers */
export function slideLabel(s: Slide): string {
  return s.kind === 'title' ? 'Title' : s.kind === 'overview' ? 'Timeline overview' : s.kind === 'other' ? 'Other work' : s.name
}

/** slide index from the `slide` query (1-based), clamped to the deck */
export function slideIndex(q: unknown, count: number): number {
  const n = Number.parseInt(String(Array.isArray(q) ? q[0] : q ?? ''), 10)
  return Math.min(Math.max(Number.isFinite(n) ? n - 1 : 0, 0), Math.max(0, count - 1))
}
