import type { Commit, HeatmapRow } from '@one-on-one/shared'

export interface CommitQuery {
  from?: string
  to?: string
  repoIds?: string[]
}

export interface CommitStore {
  /** Insert commits not yet seen (by hash); returns the number of new ones. */
  upsert(commits: Commit[]): number
  query(q: CommitQuery): Commit[]
  heatmap(q: CommitQuery): HeatmapRow[]
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Date-only strings are local days: `from` = start of day, `to` = end of day (inclusive). */
function bound(value: string | undefined, end: boolean): number | null {
  if (!value) return null
  if (DATE_ONLY.test(value)) {
    const [y, m, d] = value.split('-').map(Number) as [number, number, number]
    return (end ? new Date(y, m - 1, d + 1) : new Date(y, m - 1, d)).getTime() - (end ? 1 : 0)
  }
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

export function localDay(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export class MemoryCommitStore implements CommitStore {
  private byHash = new Map<string, Commit>()

  upsert(commits: Commit[]): number {
    let added = 0
    for (const c of commits) {
      if (this.byHash.has(c.hash)) continue
      this.byHash.set(c.hash, c)
      added++
    }
    return added
  }

  query({ from, to, repoIds }: CommitQuery): Commit[] {
    const lo = bound(from, false)
    const hi = bound(to, true)
    const repos = repoIds?.length ? new Set(repoIds) : null
    return [...this.byHash.values()]
      .filter((c) => {
        const t = Date.parse(c.date)
        return (lo === null || t >= lo) && (hi === null || t <= hi) && (!repos || repos.has(c.repoId))
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  }

  heatmap(q: CommitQuery): HeatmapRow[] {
    const counts = new Map<string, HeatmapRow>()
    for (const c of this.query(q)) {
      const day = localDay(c.date)
      const key = `${day}|${c.repoId}`
      const row = counts.get(key)
      if (row) row.commits++
      else counts.set(key, { day, repoId: c.repoId, commits: 1 })
    }
    return [...counts.values()].sort((a, b) => a.day.localeCompare(b.day) || a.repoId.localeCompare(b.repoId))
  }
}
