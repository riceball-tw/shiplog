import type { EChartsOption } from 'echarts'
import type { Repo } from '@shiplog/shared'
import type { Range, TimedCommit } from '../stores/app'
import { COMMIT_TYPE_COLORS } from './commitTypes'
import { DAY, dayStart, fmtLong, weekStart } from './dates'

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
