import { commitKey, type Commit, type Notes, type Theme } from '@shiplog/shared'
import { groupByTicket, makeGroup, type Item, type ThemeCardData, type ThemeGrouping, type TicketGroup } from './summary'

/**
 * The theme a commit belongs to, or null. Explicit commit assignment beats ticket beats repo;
 * within a tier the first theme (in theme order) wins, so a commit is in at most one theme.
 */
export function themeOf(commit: Commit, themes: Theme[]): Theme | null {
  const key = commitKey(commit)
  return (
    themes.find((t) => t.commits.includes(key)) ??
    themes.find((t) => commit.tickets.some((k) => t.tickets.includes(k))) ??
    themes.find((t) => t.repoIds.includes(commit.repoId)) ??
    null
  )
}

/** Split no-ticket groups by repo so each can be assigned on its own. */
function splitNoTicket(groups: TicketGroup[]): TicketGroup[] {
  return groups.flatMap((g) => {
    if (g.key !== null) return [g]
    const byRepo = new Map<string, Item[]>()
    for (const it of g.items) byRepo.set(it.commit.repoId, [...(byRepo.get(it.commit.repoId) ?? []), it])
    return [...byRepo.values()].map((items) => makeGroup(null, items))
  })
}

export function groupByTheme(items: Item[], notes: Notes): ThemeGrouping {
  const starred = new Set(notes.highlights)
  const owned = new Map<string, Item[]>()
  const loose: Item[] = []
  for (const it of items) {
    const t = themeOf(it.commit, notes.themes)
    if (!t) loose.push(it)
    else owned.set(t.id, [...(owned.get(t.id) ?? []), it])
  }
  const cards: ThemeCardData[] = []
  const empty: Theme[] = []
  for (const theme of notes.themes) {
    const mine = owned.get(theme.id)
    if (!mine) {
      empty.push(theme)
      continue
    }
    const ts = mine.map((i) => i.ts)
    cards.push({
      theme,
      items: mine,
      highlights: mine.filter((i) => starred.has(commitKey(i.commit))).sort((a, b) => a.ts - b.ts),
      tickets: groupByTicket(mine),
      first: Math.min(...ts),
      last: Math.max(...ts),
      repoIds: [...new Set(mine.map((i) => i.commit.repoId))],
    })
  }
  return { cards, empty, unassigned: splitNoTicket(groupByTicket(loose)) }
}
