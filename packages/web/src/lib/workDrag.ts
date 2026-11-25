import { commitKey, type Notes } from '@shiplog/shared'
import type { TicketGroup } from './summary'

/** One draggable piece of work: a ticket (whole ticket) or a set of commits with no ticket. */
export interface WorkUnit {
  id: string
  /** ticket key, or null for a commit-level unit */
  ticket: string | null
  /** commit keys the unit covers (explicit assignments of these are cleared when it moves) */
  commits: string[]
}

export function unitOfGroup(g: TicketGroup): WorkUnit {
  const commits = g.items.map((i) => commitKey(i.commit))
  return { id: g.key ? `t:${g.key}` : `c:${commits.join(',')}`, ticket: g.key, commits }
}
export const unitOfCommit = (key: string): WorkUnit => ({ id: `c:${key}`, ticket: null, commits: [key] })

// ---- selection (ids in list order) ----
export function toggleSelect(sel: string[], id: string): string[] {
  return sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
}
/** add everything between `anchor` and `id` (inclusive, in `order`) to `base` */
export function rangeSelect(order: string[], anchor: string, id: string, base: string[]): string[] {
  const a = order.indexOf(anchor)
  const b = order.indexOf(id)
  if (b < 0) return base
  const [lo, hi] = a < 0 ? [b, b] : [Math.min(a, b), Math.max(a, b)]
  return [...new Set([...base, ...order.slice(lo, hi + 1)])]
}
export const clearSelect = (): string[] => []

const without = (list: string[], drop: Set<string>) => list.filter((x) => !drop.has(x))

/**
 * Move units into theme `targetId`, or out of every theme when null. They leave their old theme
 * (explicit ticket/commit entries), no duplicates. A unit that was in a theme only via `repoIds`
 * gets an explicit entry in the target: explicit commit/ticket beats repo in `themeOf`, so it moves.
 * Unassigning such a unit is a no-op (the repo entry would pull siblings along), so it stays put.
 */
export function moveWork(notes: Notes, targetId: string | null, units: WorkUnit[]): Notes {
  const tickets = new Set(units.flatMap((u) => (u.ticket ? [u.ticket] : [])))
  const allCommits = new Set(units.flatMap((u) => u.commits))
  const addCommits = units.filter((u) => !u.ticket).flatMap((u) => u.commits)
  return {
    ...notes,
    themes: notes.themes.map((t) => {
      const own = t.id === targetId
      return {
        ...t,
        tickets: [...new Set([...without(t.tickets, tickets), ...(own ? tickets : [])])],
        commits: [...new Set([...without(t.commits, allCommits), ...(own ? addCommits : [])])],
      }
    }),
  }
}
