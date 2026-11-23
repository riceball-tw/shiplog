import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { commitKey, type Commit, type Notes, type Repo, type ScanResult, type AppConfig, type Theme } from '@shiplog/shared'
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

const HIDDEN_KEY = 'oo.hiddenRepos'
function loadHidden(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export { commitKey }

const SAVE_DELAY = 500
const newThemeId = () => (globalThis.crypto?.randomUUID?.() ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
const without = (list: string[], drop: string[]) => list.filter((x) => !drop.includes(x))

export const useAppStore = defineStore('app', () => {
  const repos = ref<Repo[]>([])
  const config = ref<AppConfig | null>(null)
  /** ALL commits (fetched once); filtering by range/repos is client-side */
  const allCommits = shallowRef<Commit[]>([])
  const loading = ref(false)
  const scanning = ref(false)
  const error = ref<string | null>(null)
  /** failed notes save; separate from `error` so the summary stays visible. Cleared by the next successful save */
  const notesError = ref<string | null>(null)
  const lastScan = ref<ScanResult | null>(null)
  const range = ref<Range>(presetRange('twoWeeks')!)
  const hiddenRepoIds = ref<string[]>(loadHidden())
  // view filter only (no rescan): remembered per browser
  watch(hiddenRepoIds, (v) => {
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  })
  const selectedKey = ref<string | null>(null)
  /** set by the themes timeline; the matching ThemeCard scrolls into view, expands, then clears it */
  const themeFocus = ref<{ id: string } | null>(null)
  const notes = ref<Notes>({ themes: [], highlights: [] })
  /** don't PUT before the first GET succeeded: that would overwrite saved notes with empty ones */
  let notesLoaded = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

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
  async function loadNotes() {
    try {
      notes.value = await api.getNotes()
      notesLoaded = true
    } catch (e) {
      error.value = msg(e)
    }
  }
  async function init() {
    await Promise.all([loadRepos(), loadConfig(), loadCommits(), loadNotes()])
  }

  // ---- notes: themes + highlights, saved debounced ----
  async function flushNotes() {
    clearTimeout(saveTimer)
    if (!notesLoaded) return
    try {
      await api.putNotes(notes.value)
      notesError.value = null
    } catch (e) {
      notesError.value = `Could not save notes: ${msg(e)}`
    }
  }
  /** apply a change to the notes and schedule a save */
  function editNotes(fn: (n: Notes) => Notes) {
    notes.value = fn(notes.value)
    clearTimeout(saveTimer)
    saveTimer = setTimeout(flushNotes, SAVE_DELAY)
  }
  const patchTheme = (id: string, fn: (t: Theme) => Theme) =>
    editNotes((n) => ({ ...n, themes: n.themes.map((t) => (t.id === id ? fn(t) : t)) }))

  function createTheme(name = 'New theme'): string {
    const id = newThemeId()
    editNotes((n) => ({ ...n, themes: [...n.themes, { id, name, outcome: '', tickets: [], commits: [], repoIds: [] }] }))
    return id
  }
  const renameTheme = (id: string, name: string) => patchTheme(id, (t) => ({ ...t, name }))
  const setOutcome = (id: string, outcome: string) => patchTheme(id, (t) => ({ ...t, outcome }))
  const deleteTheme = (id: string) => editNotes((n) => ({ ...n, themes: n.themes.filter((t) => t.id !== id) }))
  /** move theme `id` to the position currently held by `targetId` */
  function reorderTheme(id: string, targetId: string) {
    editNotes((n) => {
      const from = n.themes.findIndex((t) => t.id === id)
      const to = n.themes.findIndex((t) => t.id === targetId)
      if (from < 0 || to < 0 || from === to) return n
      const themes = [...n.themes]
      themes.splice(to, 0, ...themes.splice(from, 1))
      return { ...n, themes }
    })
  }
  /** add tickets / commit keys / repo ids to a theme (they leave any other theme) */
  function assign(id: string, what: { tickets?: string[]; commits?: string[]; repoIds?: string[] }) {
    const { tickets = [], commits = [], repoIds = [] } = what
    editNotes((n) => ({
      ...n,
      themes: n.themes.map((t) => {
        const own = t.id === id
        return {
          ...t,
          tickets: [...new Set([...without(t.tickets, tickets), ...(own ? tickets : [])])],
          commits: [...new Set([...without(t.commits, commits), ...(own ? commits : [])])],
          repoIds: [...new Set([...without(t.repoIds, repoIds), ...(own ? repoIds : [])])],
        }
      }),
    }))
  }
  function unassign(id: string, what: { tickets?: string[]; commits?: string[]; repoIds?: string[] }) {
    patchTheme(id, (t) => ({
      ...t,
      tickets: without(t.tickets, what.tickets ?? []),
      commits: without(t.commits, what.commits ?? []),
      repoIds: without(t.repoIds, what.repoIds ?? []),
    }))
  }
  const isHighlighted = (key: string) => notes.value.highlights.includes(key)
  function toggleHighlight(key: string) {
    editNotes((n) => ({
      ...n,
      highlights: n.highlights.includes(key) ? n.highlights.filter((k) => k !== key) : [...n.highlights, key],
    }))
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
  /** replace the whole hidden set (show all / hide all / solo) */
  function setHiddenRepoIds(ids: string[]) {
    hiddenRepoIds.value = [...new Set(ids)]
  }
  const focusTheme = (id: string) => (themeFocus.value = { id })
  const clearThemeFocus = () => (themeFocus.value = null)
  function select(c: { repoId: string; hash: string } | null) {
    selectedKey.value = c ? commitKey(c) : null
  }

  return {
    repos, config, allCommits, loading, scanning, error, notesError, lastScan, range, hiddenRepoIds, selectedKey, notes, themeFocus,
    timedCommits, visibleCommits, commitsInRange, sortedRepos, repoColors, topRepoIds, isOther, visibleRepos, extent,
    loadRepos, loadConfig, loadCommits, loadNotes, init,
    flushNotes, createTheme, renameTheme, setOutcome, deleteTheme, reorderTheme, assign, unassign, isHighlighted, toggleHighlight,
    scan, saveConfigAndRescan, setRange, toggleRepo, setHiddenRepoIds, select, focusTheme, clearThemeFocus,
  }
})
