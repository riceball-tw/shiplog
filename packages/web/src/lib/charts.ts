import type { EChartsOption } from 'echarts'
import { commitKey, type Repo, type Theme } from '@shiplog/shared'
import type { Range, TimedCommit } from '../stores/app'
import { COMMIT_TYPE_COLORS } from './commitTypes'
import { addDays, DAY, dayEnd, dayStart, fmtLong, fmtShort, weekStart } from './dates'
import { cleanSubject } from './summary'
import { themeOf } from './themes'

export const OVERVIEW_HEIGHT = 140
export const LANE_HEIGHT = 44
export const SWIMLANE_AXIS_HEIGHT = 36

export interface ChartTheme {
  text: string
  textMuted: string
  grid: string
  surface: string
  tooltipBg: string
  tooltipBorder: string
  accent: string
}

export function chartTheme(dark: boolean): ChartTheme {
  return dark
    ? { text: '#e2e8f0', textMuted: '#94a3b8', grid: '#1e293b', surface: '#0f172a', tooltipBg: '#1e293b', tooltipBorder: '#334155', accent: '#818cf8' }
    : { text: '#0f172a', textMuted: '#64748b', grid: '#e2e8f0', surface: '#ffffff', tooltipBg: '#ffffff', tooltipBorder: '#cbd5e1', accent: '#4f46e5' }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const dot = (color: string) => `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>`
const tooltipBase = (t: ChartTheme) => ({
  backgroundColor: t.tooltipBg,
  borderColor: t.tooltipBorder,
  borderWidth: 1,
  textStyle: { color: t.text, fontSize: 12 },
  extraCssText: 'max-width:340px;white-space:normal;box-shadow:0 4px 12px rgba(0,0,0,.15);',
  confine: true,
})

const OTHER_SERIES = '__other__'
export const WEEKLY_THRESHOLD_DAYS = 120

// ---------------------------------------------------------------- overview

export interface OverviewArgs {
  commits: TimedCommit[]
  /** visible repos, in legend order */
  repos: Repo[]
  colors: Map<string, string>
  /** repos with their own series, in rank order; all other repos merge into "Other" */
  topRepoIds: string[]
  otherColor: string
  extent: Range
  theme: ChartTheme
}

export function buildOverviewOption(a: OverviewArgs): EChartsOption {
  const { theme: t, extent } = a
  const weekly = (extent.to - extent.from) / DAY > WEEKLY_THRESHOLD_DAYS
  const bucketOf = weekly ? weekStart : dayStart
  const half = (weekly ? 7 * DAY : DAY) / 2

  const counts = new Map<string, Map<number, number>>()
  for (const c of a.commits) {
    const b = bucketOf(c.ts)
    let m = counts.get(c.repoId)
    if (!m) counts.set(c.repoId, (m = new Map()))
    m.set(b, (m.get(b) ?? 0) + 1)
  }

  // ECharts only stacks bars correctly when every series has a point for every bucket;
  // sparse series stack against the wrong neighbours and float. Densify with zeros.
  // Step via bucketOf(b + step + half) rather than b + step so DST shifts can't drift the keys.
  const buckets: number[] = []
  for (let b = bucketOf(extent.from); b <= extent.to; b = bucketOf(b + 3 * half)) buckets.push(b)

  const topSet = new Set(a.topRepoIds)
  const topRepos = a.repos.filter((r) => topSet.has(r.id))
  const otherIds = a.repos.filter((r) => !topSet.has(r.id)).map((r) => r.id)
  const barBase = {
    type: 'bar' as const,
    stack: 'commits',
    xAxisIndex: 0,
    yAxisIndex: 0,
    barMaxWidth: 14,
    barMinWidth: 2,
    emphasis: { focus: 'none' as const },
  }
  // [bar center, count, bucket start, extra]; zero buckets drop the border so they don't draw a hairline
  const cell = (b: number, n: number, extra = 0) =>
    n ? [b + half, n, b, extra] : { value: [b + half, 0, b, 0], itemStyle: { borderWidth: 0 } }
  const bars = topRepos.map((r) => ({
    ...barBase,
    name: r.name,
    itemStyle: { color: a.colors.get(r.id), borderColor: t.surface, borderWidth: 1 },
    data: buckets.map((b) => cell(b, counts.get(r.id)?.get(b) ?? 0)),
  }))
  // single merged "Other" series, stacked last (on top) in a neutral color
  const otherBar = otherIds.length
    ? [
        {
          ...barBase,
          name: OTHER_SERIES,
          itemStyle: { color: a.otherColor, borderColor: t.surface, borderWidth: 1 },
          data: buckets.map((b) => {
            let n = 0
            let repos = 0
            for (const id of otherIds) {
              const k = counts.get(id)?.get(b) ?? 0
              if (k) { n += k; repos++ }
            }
            return cell(b, n, repos)
          }),
        },
      ]
    : []

  const axisCommon = { type: 'time' as const, min: extent.from, max: extent.to }
  return {
    animation: false,
    grid: { left: 34, right: 12, top: 20, bottom: 22 },
    xAxis: [
      {
        ...axisCommon,
        axisLine: { lineStyle: { color: t.grid } },
        axisTick: { show: false },
        axisLabel: { color: t.textMuted, fontSize: 11, hideOverlap: true },
        splitLine: { show: false },
      },
      // hidden twin axis: the dataZoom slider controls this one so the bars always show full history
      { ...axisCommon, show: false },
    ],
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 2,
      minInterval: 1,
      axisLabel: { color: t.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: t.grid } },
    },
    tooltip: {
      ...tooltipBase(t),
      trigger: 'axis',
      axisPointer: { type: 'line', snap: true, lineStyle: { color: t.textMuted, width: 1 } },
      formatter: (raw: unknown) => {
        // p.value (not p.data): zero buckets are { value, itemStyle } objects
        const ps = (raw as any[]).filter((p) => p.seriesType === 'bar' && p.value?.[1] > 0)
        if (!ps.length) return ''
        const start = ps[0].value[2] as number
        const bucket = ps.filter((p) => p.value[2] === start)
        const total = bucket.reduce((s, p) => s + p.value[1], 0)
        const title = weekly ? `Week of ${fmtLong(start)}` : fmtLong(start)
        const rows = bucket
          .map((p) => {
            const label = p.seriesName === OTHER_SERIES ? `Other (${p.value[3]} repo${p.value[3] === 1 ? '' : 's'})` : esc(p.seriesName)
            return `<div>${dot(p.color)}${label}: <b>${p.value[1]}</b></div>`
          })
          .join('')
        return `<div style="font-weight:600;margin-bottom:4px">${title}</div>${rows}<div style="margin-top:4px;color:${t.textMuted}">${total} commits</div>`
      },
    },
    series: [
      ...bars,
      ...otherBar,
      {
        // invisible series that gives the hidden axis its extent
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 0,
        silent: true,
        tooltip: { show: false },
        showSymbol: false,
        lineStyle: { opacity: 0 },
        data: [[extent.from, 0], [extent.to, 0]],
      },
    ],
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 1,
        filterMode: 'none',
        realtime: true,
        left: 34,
        right: 12,
        top: 20,
        height: OVERVIEW_HEIGHT - 20 - 22,
        minValueSpan: DAY,
        brushSelect: false,
        showDetail: false,
        showDataShadow: false,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        fillerColor: t.accent + '2e',
        handleSize: '70%',
        handleStyle: { color: t.accent, borderColor: t.accent },
        moveHandleSize: 0,
        textStyle: { color: t.textMuted },
        dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
        selectedDataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      },
    ],
  }
}

// ---------------------------------------------------------------- swimlane

export interface SwimlaneArgs {
  commits: TimedCommit[]
  lanes: Repo[]
  extent: Range
  selectedKey: string | null
  theme: ChartTheme
}

export const swimlaneHeight = (lanes: number) => Math.max(1, lanes) * LANE_HEIGHT + SWIMLANE_AXIS_HEIGHT

/** log-scale dot size from lines changed, clamped to 8..20 px */
export const dotSize = (lines: number) => Math.min(20, Math.max(8, 8 + 2.5 * Math.log10(1 + lines)))

/** deterministic jitter in [-0.28, 0.28] from the commit hash, so same-day dots don't overlap exactly */
function jitter(hash: string): number {
  const n = parseInt(hash.slice(0, 6), 16)
  return Number.isNaN(n) ? 0 : ((n % 1000) / 1000 - 0.5) * 0.56
}

export function buildSwimlaneOption(a: SwimlaneArgs): EChartsOption {
  const { theme: t, extent } = a
  const laneIndex = new Map(a.lanes.map((r, i) => [r.id, i]))
  const names = new Map(a.lanes.map((r) => [r.id, r.name]))
  const point = (c: TimedCommit) => [c.ts, laneIndex.get(c.repoId)! + jitter(c.hash)]

  const shown = a.commits.filter((c) => laneIndex.has(c.repoId))
  const data = shown.map((c) => ({
    value: point(c),
    symbolSize: dotSize(c.insertions + c.deletions),
    itemStyle: {
      color: COMMIT_TYPE_COLORS[c.classification.type].hex,
      opacity: c.classification.confidence === 'low' ? 0.4 : 0.9,
      borderColor: t.surface,
      borderWidth: 1,
    },
    hash: c.hash,
    repoId: c.repoId,
  }))
  const sel = a.selectedKey ? shown.find((c) => `${c.repoId}:${c.hash}` === a.selectedKey) : undefined

  return {
    animation: false,
    grid: { left: 110, right: 12, top: 6, bottom: SWIMLANE_AXIS_HEIGHT - 6 },
    xAxis: {
      type: 'time',
      min: extent.from,
      max: extent.to,
      axisLine: { lineStyle: { color: t.grid } },
      axisTick: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 11, hideOverlap: true },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: a.lanes.map((r) => r.name),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: t.text, fontSize: 12, width: 96, overflow: 'truncate' },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    tooltip: {
      ...tooltipBase(t),
      trigger: 'item',
      formatter: (p: any) => {
        const c = shown.find((x) => x.hash === p.data?.hash && x.repoId === p.data?.repoId)
        if (!c) return ''
        const type = c.classification.type
        const when = new Date(c.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        const subject = c.subject.length > 120 ? c.subject.slice(0, 120) + '…' : c.subject
        const tickets = c.tickets.length ? `<div style="color:${t.textMuted}">${esc(c.tickets.join(', '))}</div>` : ''
        return (
          `<div style="color:${t.textMuted}">${esc(when)} · ${esc(names.get(c.repoId) ?? '')}</div>` +
          `<div style="margin:3px 0">${dot(COMMIT_TYPE_COLORS[type].hex)}<b>${type}${c.classification.breaking ? '!' : ''}</b>` +
          (c.classification.confidence === 'low' ? ` <span style="color:${t.textMuted}">(guessed)</span>` : '') +
          `</div><div style="font-weight:600">${esc(subject)}</div>` +
          `<div style="margin-top:3px;font-family:ui-monospace,monospace"><span style="color:#10b981">+${c.insertions}</span> <span style="color:#ef4444">−${c.deletions}</span></div>` +
          tickets
        )
      },
    },
    series: [
      { type: 'scatter', name: 'commits', data, emphasis: { scale: 1.25 }, z: 2 },
      {
        type: 'scatter',
        name: 'selected',
        silent: true,
        tooltip: { show: false },
        z: 10,
        symbolSize: sel ? dotSize(sel.insertions + sel.deletions) + 8 : 0,
        itemStyle: { color: 'transparent', borderColor: t.text, borderWidth: 2 },
        data: sel ? [point(sel)] : [],
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
        zoomOnMouseWheel: true, // plain wheel is filtered out in SwimlaneChart.vue (capture) so the page scrolls; Ctrl/⌘/pinch zooms
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        minValueSpan: DAY,
      },
    ],
  }
}

// ---------------------------------------------------------------- theme gantt

export const GANTT_ROW_HEIGHT = 28
export const GANTT_AXIS_HEIGHT = 28
export const OTHER_ROW_ID = '__other__'
/** ranges up to this long get per-day density buckets, longer ones per-week */
export const GANTT_DAILY_MAX_DAYS = 42

export interface GanttBucket {
  start: number
  end: number
  count: number
}
export interface GanttRow {
  id: string
  name: string
  outcome: string
  /** index into the theme order (palette slot); -1 for "Other work" */
  colorIdx: number
  first: number
  last: number
  tickets: number
  commits: number
  /** timestamps of starred commits */
  stars: number[]
  /** starred commits with cleaned titles, oldest first (Mermaid milestones) */
  starred: { ts: number; title: string }[]
  buckets: GanttBucket[]
}

/** One row per theme with commits in range (theme order), then "Other work" for unassigned commits. */
export function themeGanttRows(commits: TimedCommit[], themes: Theme[], highlights: string[], range: Range): GanttRow[] {
  const starred = new Set(highlights)
  const daily = (range.to - range.from) / DAY <= GANTT_DAILY_MAX_DAYS
  const owned = new Map<string, TimedCommit[]>()
  const loose: TimedCommit[] = []
  for (const c of commits) {
    const t = themeOf(c, themes)
    if (!t) loose.push(c)
    else owned.set(t.id, [...(owned.get(t.id) ?? []), c])
  }
  const make = (id: string, name: string, outcome: string, colorIdx: number, cs: TimedCommit[]): GanttRow => {
    const ts = cs.map((c) => c.ts)
    const first = Math.max(range.from, dayStart(Math.min(...ts)))
    const last = Math.min(range.to, dayEnd(Math.max(...ts)))
    const counts = new Map<number, number>()
    for (const c of cs) {
      const b = daily ? dayStart(c.ts) : weekStart(c.ts)
      counts.set(b, (counts.get(b) ?? 0) + 1)
    }
    const buckets = [...counts]
      .sort((a, b) => a[0] - b[0])
      .map(([b, count]) => ({ start: Math.max(first, b), end: Math.min(last, daily ? dayEnd(b) : addDays(b, 7)), count }))
    return {
      id,
      name,
      outcome,
      colorIdx,
      first,
      last,
      tickets: new Set(cs.flatMap((c) => c.tickets)).size,
      commits: cs.length,
      stars: cs.filter((c) => starred.has(commitKey(c))).map((c) => c.ts),
      starred: cs
        .filter((c) => starred.has(commitKey(c)))
        .sort((a, b) => a.ts - b.ts)
        .map((c) => ({ ts: c.ts, title: cleanSubject(c.subject, c.tickets) })),
      buckets,
    }
  }
  const rows = themes.flatMap((t, i) => (owned.has(t.id) ? [make(t.id, t.name.trim() || 'Untitled theme', t.outcome.trim(), i, owned.get(t.id)!)] : []))
  if (loose.length) rows.push(make(OTHER_ROW_ID, 'Other work', '', -1, loose))
  return rows
}

export const themeGanttHeight = (rows: number, scale = 1) => (Math.max(1, rows) * GANTT_ROW_HEIGHT + GANTT_AXIS_HEIGHT) * scale

const STAR_PATH = 'path://M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export interface ThemeGanttArgs {
  rows: GanttRow[]
  range: Range
  /** theme palette, indexed by colorIdx % length */
  colors: string[]
  otherColor: string
  theme: ChartTheme
  /** sizes (rows, fonts, marks) multiplied for the presentation view; default 1 */
  scale?: number
}

export function buildThemeGanttOption(a: ThemeGanttArgs): EChartsOption {
  const { theme: t, rows, range } = a
  const k = a.scale ?? 1
  const colorOf = (r: GanttRow) => (r.colorIdx < 0 ? a.otherColor : a.colors[r.colorIdx % a.colors.length]!)
  const maxCount = (r: GanttRow) => Math.max(...r.buckets.map((b) => b.count))
  // thin rounded rect centred on the row; `min` keeps one-day marks visible
  const rect = (h: number, min: number) => (_: unknown, api: any) => {
    const row = api.value(0)
    const s = api.coord([api.value(1), row])
    const e = api.coord([api.value(2), row])
    return {
      type: 'rect' as const,
      shape: { x: s[0], y: s[1] - h / 2, width: Math.max(e[0] - s[0], min), height: h, r: Math.min(h / 2, 3) },
      style: { fill: colorOf(rows[row]!), opacity: api.value(3) },
    }
  }
  const span = rows.map((r, i) => ({ value: [i, r.first, r.last, 0.22], row: i }))
  const density = rows.flatMap((r, i) => r.buckets.map((b) => ({ value: [i, b.start, b.end, 0.4 + 0.6 * (b.count / maxCount(r))], row: i })))
  const stars = rows.flatMap((r, i) => r.stars.map((ts) => ({ value: [ts, i], row: i })))

  const tip = (i: number) => {
    const r = rows[i]
    if (!r) return ''
    const when = fmtShort(r.first) === fmtShort(r.last) ? fmtShort(r.first) : `${fmtShort(r.first)} – ${fmtShort(r.last)}`
    const outcome =
      r.id === OTHER_ROW_ID
        ? `<div style="color:${t.textMuted}">Not in any theme</div>`
        : r.outcome
          ? `<div style="margin:3px 0">${esc(r.outcome)}</div>`
          : `<div style="margin:3px 0;color:${t.textMuted}">no outcome yet</div>`
    return (
      `<div style="font-weight:600">${dot(colorOf(r))}${esc(r.name)}</div>${outcome}` +
      `<div style="color:${t.textMuted}">${esc(when)} · ${plural(r.tickets, 'ticket')} · ${plural(r.commits, 'commit')} · ${plural(r.stars.length, 'highlight')}</div>`
    )
  }
  const common = { coordinateSystem: 'cartesian2d' as const, encode: { x: [1, 2], y: 0 }, clip: true }

  return {
    animation: false,
    // grid matches the swimlane so both charts line up vertically
    grid: { left: 110 * k, right: 12 * k, top: 4 * k, bottom: (GANTT_AXIS_HEIGHT - 4) * k },
    xAxis: {
      type: 'time',
      min: range.from,
      max: range.to,
      axisLine: { lineStyle: { color: t.grid } },
      axisTick: { show: false },
      axisLabel: { color: t.textMuted, fontSize: 11 * k, hideOverlap: true },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => r.id),
      triggerEvent: true,
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: {
        color: t.text,
        fontSize: 12 * k,
        width: 96 * k,
        overflow: 'truncate',
        formatter: (id: string) => {
          const r = rows.find((x) => x.id === id)
          return r?.id === OTHER_ROW_ID ? `{muted|${r.name}}` : (r?.name ?? '')
        },
        rich: { muted: { color: t.textMuted, fontSize: 12 * k } },
      },
      splitLine: { show: true, lineStyle: { color: t.grid } },
    },
    tooltip: { ...tooltipBase(t), trigger: 'item', formatter: (p: any) => tip(p.data?.row) },
    series: [
      { type: 'custom', name: 'span', ...common, renderItem: rect(10 * k, 4 * k), data: span, z: 1 },
      { type: 'custom', name: 'density', ...common, renderItem: rect(10 * k, 3 * k), data: density, z: 2 },
      {
        type: 'scatter',
        name: 'stars',
        data: stars,
        symbol: STAR_PATH,
        symbolSize: 12 * k,
        itemStyle: { color: '#fbbf24', borderColor: t.surface, borderWidth: 1 },
        z: 3,
      },
    ],
  }
}
