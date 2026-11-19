export interface ColorPair {
  light: string
  dark: string
}

export interface RepoColorAssignment {
  /** top repos, in rank order (index = categorical slot) */
  topRepoIds: string[]
  /** color for every given repo id; non-top repos get `other` */
  colors: Map<string, ColorPair>
  isOther: (id: string) => boolean
}

/**
 * Rank repos by commit count (desc; ties by name then id) and give the top
 * `palette.light.length` the categorical colors in rank order. Everything else is "Other".
 * Repos with no commits never take a categorical slot.
 */
export function assignRepoColors(
  repos: { id: string; name: string }[],
  commitCounts: ReadonlyMap<string, number>,
  palette: { light: readonly string[]; dark: readonly string[] },
  other: ColorPair,
): RepoColorAssignment {
  const slots = palette.light.length
  const ranked = repos
    .filter((r) => (commitCounts.get(r.id) ?? 0) > 0)
    .sort((a, b) => (commitCounts.get(b.id)! - commitCounts.get(a.id)!) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const topRepoIds = ranked.slice(0, slots).map((r) => r.id)
  const colors = new Map<string, ColorPair>()
  for (const r of repos) colors.set(r.id, other)
  topRepoIds.forEach((id, i) => colors.set(id, { light: palette.light[i]!, dark: palette.dark[i]! }))
  const top = new Set(topRepoIds)
  return { topRepoIds, colors, isOther: (id) => !top.has(id) }
}
