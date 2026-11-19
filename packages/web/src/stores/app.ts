import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { Commit, Repo, ScanResult, AppConfig } from '@one-on-one/shared'
import * as api from '../api'
import { CATEGORICAL, OTHER_COLOR } from '../lib/theme'
import { assignRepoColors } from '../lib/repoColors'
import { DAY, dayEnd, dayStart, presetRange, ymd } from '../lib/dates'

/** Inclusive range in epoch ms: from = local start of day, to = local end of day. */
export interface Range {
  from: number
  to: number
}
export type TimedCommit = Commit & { ts: number }

/** Parse config.since: ISO date or "N months ago" style. null if unknown. */
function parseSince(s: string): number | null {
  const t = Date.parse(s)
  if (!Number.isNaN(t)) return t
  const m = /^(\d+)\s*(day|week|month|year)s?\s+ago$/i.exec(s.trim())
  if (!m) return null
  const d = new Date()
  const n = +m[1]!
  const unit = m[2]!.toLowerCase()
  if (unit === 'day') d.setDate(d.getDate() - n)
  else if (unit === 'week') d.setDate(d.getDate() - 7 * n)
  else if (unit === 'month') d.setMonth(d.getMonth() - n)
  else d.setFullYear(d.getFullYear() - n)
  return d.getTime()
}

export const commitKey = (c: { repoId: string; hash: string }) => `${c.repoId}:${c.hash}`

export const useAppStore = defineStore('app', () => {
  const repos = ref<Repo[]>([])
  const config = ref<AppConfig | null>(null)
  /** ALL commits (fetched once); filtering by range/repos is client-side */
  const allCommits = shallowRef<Commit[]>([])
  const loading = ref(false)
  const scanning = ref(false)
  const error = ref<string | null>(null)
  const lastScan = ref<ScanResult | null>(null)
  const range = ref<Range>(presetRange('twoWeeks')!)
  const hiddenRepoIds = ref<string[]>([])
  const selectedKey = ref<string | null>(null)

  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

  // ---- getters ----
  /** newest first */
  const timedCommits = computed<TimedCommit[]>(() =>
    allCommits.value.map((c) => ({ ...c, ts: Date.parse(c.date) })).sort((a, b) => b.ts - a.ts),
  )
  const visibleCommits = computed(() => {
    const hidden = new Set(hiddenRepoIds.value)
    return timedCommits.value.filter((c) => !hidden.has(c.repoId))
  })
  const commitsInRange = computed(() => {
    const { from, to } = range.value
    return visibleCommits.value.filter((c) => c.ts >= from && c.ts <= to)
  })
  const sortedRepos = computed(() => [...repos.value].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)))
  /** commit totals over ALL loaded commits (not the range) so colors stay stable while dragging */
  const commitCounts = computed(() => {
    const m = new Map<string, number>()
    for (const c of allCommits.value) m.set(c.repoId, (m.get(c.repoId) ?? 0) + 1)
    return m
  })
  /** top 8 included repos by total commits get categorical colors; the rest share a neutral "Other" */
  const colorAssignment = computed(() =>
    assignRepoColors(
      sortedRepos.value.filter((r) => r.included),
      commitCounts.value,
      CATEGORICAL,
      OTHER_COLOR,
    ),
  )
  /** color per repo id (non-top repos get the neutral Other color) */
  const repoColors = computed(() => {
    const m = new Map(colorAssignment.value.colors)
    for (const r of sortedRepos.value) if (!m.has(r.id)) m.set(r.id, OTHER_COLOR)
    return m
  })
  const topRepoIds = computed(() => colorAssignment.value.topRepoIds)
  const isOther = (id: string) => colorAssignment.value.isOther(id)
  /** repos shown as lanes/series: included and not toggled off */
  const visibleRepos = computed(() => sortedRepos.value.filter((r) => r.included && !hiddenRepoIds.value.includes(r.id)))
  const meetings = computed(() => [...(config.value?.meetings ?? [])].sort())
  /** full history span: config.since / first commit -> end of today */
  const extent = computed<Range>(() => {
    const first = timedCommits.value.at(-1)?.ts
    const since = config.value ? parseSince(config.value.since) : null
    const candidates = [first, since].filter((x): x is number => x != null)
    const from = candidates.length ? Math.min(...candidates) : Date.now() - 365 * DAY
    return { from: dayStart(from), to: dayEnd(Date.now()) }
  })

  // ---- actions ----
  async function loadRepos() {
    try {
      repos.value = await api.getRepos()
    } catch (e) {
      error.value = msg(e)
    }
  }
  async function loadConfig() {
    try {
      config.value = await api.getConfig()
    } catch (e) {
      error.value = msg(e)
    }
  }
  async function loadCommits() {
    loading.value = true
    try {
      allCommits.value = await api.getCommits()
      error.value = null
    } catch (e) {
      error.value = msg(e)
    } finally {
      loading.value = false
    }
  }
  async function init() {
    await Promise.all([loadRepos(), loadConfig(), loadCommits()])
  }
  async function scan() {
    scanning.value = true
    try {
      lastScan.value = await api.scan()
      error.value = null
      await init()
    } catch (e) {
      error.value = msg(e)
    } finally {
      scanning.value = false
    }
  }

  /** Persist config (throws ApiError with .details on 400), rescan, then reload repos/config/commits. */
  async function saveConfigAndRescan(next: AppConfig): Promise<ScanResult> {
    config.value = await api.putConfig(next)
    scanning.value = true
    try {
      const result = await api.scan()
      lastScan.value = result
      error.value = null
      await init()
      return result
    } finally {
      scanning.value = false
    }
  }

  function setRange(r: Range) {
    const from = Math.min(r.from, r.to)
    const to = Math.max(r.from, r.to)
    if (from === range.value.from && to === range.value.to) return
    range.value = { from, to }
  }
  function toggleRepo(id: string) {
    const i = hiddenRepoIds.value.indexOf(id)
    if (i >= 0) hiddenRepoIds.value = hiddenRepoIds.value.filter((x) => x !== id)
    else hiddenRepoIds.value = [...hiddenRepoIds.value, id]
  }
  function select(c: { repoId: string; hash: string } | null) {
    selectedKey.value = c ? commitKey(c) : null
  }
  /** Append today's date to config.meetings (fresh GET then PUT; no duplicates). */
  async function markTodayAsMeeting() {
    try {
      const cfg = await api.getConfig()
      const today = ymd(Date.now())
      if (!cfg.meetings.includes(today)) {
        config.value = await api.putConfig({ ...cfg, meetings: [...cfg.meetings, today].sort() })
      } else {
        config.value = cfg
      }
      error.value = null
    } catch (e) {
      error.value = msg(e)
    }
  }

  return {
    repos, config, allCommits, loading, scanning, error, lastScan, range, hiddenRepoIds, selectedKey,
    timedCommits, visibleCommits, commitsInRange, sortedRepos, repoColors, topRepoIds, isOther, visibleRepos, meetings, extent,
    loadRepos, loadConfig, loadCommits, init, scan, saveConfigAndRescan, setRange, toggleRepo, select, markTodayAsMeeting,
  }
})
