<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CommitType } from '@one-on-one/shared'
import { useAppStore } from '../stores/app'
import { fmtShort, rangeLabel } from '../lib/dates'
import { COMMIT_TYPE_COLORS } from '../lib/commitTypes'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown, TYPE_LABELS, type Item } from '../lib/summary'
import { prefersDark } from '../lib/theme'

const GROUPS = ['ticket', 'type', 'repo'] as const
type GroupBy = (typeof GROUPS)[number]
const GROUP_LABELS: Record<GroupBy, string> = { ticket: 'Ticket', type: 'Type', repo: 'Repo' }

const store = useAppStore()
const groupBy = ref<GroupBy>(loadPref('oo.summary.groupBy', GROUPS, 'ticket'))
const hideNoise = ref(loadPref('oo.summary.hideNoise', ['1', '0'] as const, '1') === '1')
watch(groupBy, (v) => savePref('oo.summary.groupBy', v))
watch(hideNoise, (v) => savePref('oo.summary.hideNoise', v ? '1' : '0'))

const summary = computed(() => summarize(store.commitsInRange, { hideNoise: hideNoise.value }))
const repoNames = computed(() => Object.fromEntries(store.repos.map((r) => [r.id, r.name])))
const repoName = (id: string) => repoNames.value[id] ?? id
const markdown = computed(() =>
  toMarkdown(summary.value, {
    rangeLabel: rangeLabel(store.range),
    groupBy: groupBy.value === 'ticket' ? 'ticket' : 'type',
    repoNames: repoNames.value,
  }),
)
const nf = (n: number) => n.toLocaleString()
const color = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}
const span = (a: number, b: number) => (fmtShort(a) === fmtShort(b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`)
const typeCounts = (items: Item[]) => {
  const m = new Map<CommitType, number>()
  for (const i of items) m.set(i.commit.classification.type, (m.get(i.commit.classification.type) ?? 0) + 1)
  return [...m]
}

// expand state for ticket rows
const open = ref(new Set<string>())
const toggle = (k: string) => {
  const s = new Set(open.value)
  if (!s.delete(k)) s.add(k)
  open.value = s
}
watch(() => store.commitsInRange, () => (open.value = new Set()))

const showPreview = ref(false)
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(markdown.value)
  } catch {
    // clipboard API unavailable (non-secure context): fall back to a hidden textarea
    const ta = document.createElement('textarea')
    ta.value = markdown.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}
const typeBadge = (t: CommitType) => COMMIT_TYPE_COLORS[t].badge
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <!-- controls -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-slate-500 dark:text-slate-400">Group by</span>
        <div class="inline-flex overflow-hidden rounded-md border border-slate-300 dark:border-slate-700" role="group">
          <button
            v-for="g in GROUPS"
            :key="g"
            class="px-3 py-1 text-sm font-medium"
            :class="groupBy === g ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'"
            :aria-pressed="groupBy === g"
            @click="groupBy = g"
          >
            {{ GROUP_LABELS[g] }}
          </button>
        </div>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        <input v-model="hideNoise" type="checkbox" class="size-4 accent-indigo-600" />
        Hide noise (chore/ci/style/build)
      </label>
      <button
        class="ml-auto rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="!summary.totals.commits"
        @click="copy"
      >
        {{ copied ? 'Copied ✓' : 'Copy as Markdown' }}
      </button>
    </div>

    <div v-if="store.error" class="m-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {{ store.error }}
    </div>
    <p v-else-if="store.loading" class="p-4 text-sm text-slate-500">Loading…</p>
    <p v-else-if="!summary.totals.commits" class="p-4 text-sm text-slate-500">No commits in this range. Try a wider range or Rescan.</p>
    <div v-else class="space-y-5 p-4">
      <p class="text-sm text-slate-600 dark:text-slate-300">
        <span class="font-semibold">{{ nf(summary.totals.commits) }}</span> commits across
        <span class="font-semibold">{{ summary.totals.repos }}</span> {{ summary.totals.repos === 1 ? 'repo' : 'repos' }} on
        <span class="font-semibold">{{ summary.totals.activeDays }}</span> active days ·
        <span class="font-mono"><span class="text-emerald-600 dark:text-emerald-400">+{{ nf(summary.totals.insertions) }}</span>
          <span class="ml-1 text-red-600 dark:text-red-400">−{{ nf(summary.totals.deletions) }}</span></span>
        <span v-if="summary.totals.noiseHidden" class="ml-1 text-slate-500 dark:text-slate-400">· {{ summary.totals.noiseHidden }} noise commits hidden</span>
      </p>

      <!-- Ticket view -->
      <ul v-if="groupBy === 'ticket'" class="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        <li v-for="g in summary.byTicket" :key="g.key ?? '__none'">
          <button class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50" :aria-expanded="open.has(g.key ?? '__none')" @click="toggle(g.key ?? '__none')">
            <span class="mt-0.5 w-3 shrink-0 text-slate-400">{{ open.has(g.key ?? '__none') ? '▾' : '▸' }}</span>
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 break-words" :title="g.title">
                <span class="font-mono font-semibold" :class="g.key === null && 'text-slate-500 dark:text-slate-400'">{{ g.key ?? 'No ticket' }}</span>
                <span v-if="g.key !== null && g.title" class="ml-2">{{ g.title }}</span>
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span v-for="[t] in typeCounts(g.items)" :key="t" class="rounded px-1.5 py-0.5 font-medium" :class="typeBadge(t)">{{ t }}</span>
                <span v-for="r in g.repoIds" :key="r" class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <span class="size-2 rounded-sm" :style="{ background: color(r) }" />{{ repoName(r) }}
                </span>
                <span>· {{ g.items.length }} {{ g.items.length === 1 ? 'commit' : 'commits' }} · {{ span(g.first, g.last) }}</span>
              </span>
            </span>
          </button>
          <ul v-if="open.has(g.key ?? '__none')" class="space-y-1 bg-slate-50 px-3 py-2 pl-9 text-sm dark:bg-slate-950/40">
            <li v-for="it in g.items" :key="it.commit.repoId + it.commit.hash" class="flex items-center gap-2">
              <span class="w-14 shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ fmtShort(it.ts) }}</span>
              <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium" :class="typeBadge(it.commit.classification.type)">{{ it.commit.classification.type }}</span>
              <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
              <span v-if="g.key === null && it.commit.classification.scope" class="shrink-0 text-xs text-slate-500">{{ it.commit.classification.scope }}</span>
            </li>
          </ul>
        </li>
      </ul>

      <!-- Type view -->
      <div v-else-if="groupBy === 'type'" class="space-y-4">
        <div v-for="g in summary.byType" :key="g.type">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-semibold">
            <span class="rounded px-1.5 py-0.5 text-xs font-medium" :class="typeBadge(g.type)">{{ g.type }}</span>
            {{ TYPE_LABELS[g.type] }} ({{ g.items.length }})
          </h3>
          <ul class="space-y-0.5 pl-1 text-sm">
            <li v-for="it in g.items" :key="it.commit.repoId + it.commit.hash" class="flex gap-2">
              <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
              <span v-for="t in it.commit.tickets" :key="t" class="shrink-0 rounded-full bg-slate-100 px-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ t }}</span>
              <span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ repoName(it.commit.repoId) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Repo view -->
      <div v-else class="grid gap-3 md:grid-cols-2">
        <div v-for="r in summary.byRepo" :key="r.repoId" class="rounded-md border border-slate-200 p-3 dark:border-slate-800">
          <h3 class="flex items-center gap-2 text-sm font-semibold">
            <span class="size-3 rounded-sm" :style="{ background: color(r.repoId) }" />
            <span class="min-w-0 flex-1 truncate">{{ repoName(r.repoId) }}</span>
            <span class="font-mono text-xs font-normal"><span class="text-emerald-600 dark:text-emerald-400">+{{ nf(r.insertions) }}</span> <span class="text-red-600 dark:text-red-400">−{{ nf(r.deletions) }}</span></span>
          </h3>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ r.commits }} commits</p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span v-for="g in r.byType" :key="g.type" class="rounded px-1.5 py-0.5 text-xs font-medium" :class="typeBadge(g.type)">{{ g.type }} {{ g.items.length }}</span>
          </div>
          <ul v-if="r.topDirs.length" class="mt-2 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
            <li v-for="d in r.topDirs.slice(0, 5)" :key="d.dir" class="flex justify-between gap-2">
              <span class="truncate font-mono">{{ d.dir }}</span><span class="shrink-0 text-slate-500">{{ nf(d.lines) }} lines</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Top areas -->
      <div v-if="summary.topDirs.length">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Top areas</h3>
        <ul class="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
          <li v-for="d in summary.topDirs" :key="d.repoId + d.dir" class="flex items-center gap-2">
            <span class="size-2 shrink-0 rounded-sm" :style="{ background: color(d.repoId) }" />
            <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="repoName(d.repoId) + ' / ' + d.dir">{{ repoName(d.repoId) }}/{{ d.dir }}</span>
            <span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ nf(d.lines) }} lines · {{ d.commits }}c</span>
          </li>
        </ul>
      </div>

      <!-- Markdown preview -->
      <div>
        <button class="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400" :aria-expanded="showPreview" @click="showPreview = !showPreview">
          {{ showPreview ? '▾' : '▸' }} Preview markdown
        </button>
        <pre v-if="showPreview" class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs dark:bg-slate-950">{{ markdown }}</pre>
      </div>
    </div>
  </section>
</template>
