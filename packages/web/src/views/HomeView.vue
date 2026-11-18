<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { dayEnd, parseYmd, ymd } from '../lib/dates'
import RangePresets from '../components/RangePresets.vue'
import OverviewChart from '../components/OverviewChart.vue'
import SwimlaneChart from '../components/SwimlaneChart.vue'
import RangeStats from '../components/RangeStats.vue'
import RepoList from '../components/RepoList.vue'
import CommitList from '../components/CommitList.vue'
import SummaryPanel from '../components/SummaryPanel.vue'
import { loadPref, savePref } from '../lib/prefs'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

/** hash query -> store.range (ignored when absent/invalid, so the default stays) */
function readUrl() {
  const from = parseYmd(route.query.from)
  const to = parseYmd(route.query.to)
  if (from == null || to == null) return
  store.setRange({ from, to: dayEnd(to) })
}
// our own router.replace calls echo back through the route watcher; ignore those
const written = new Set<string>()
function writeUrl() {
  const from = ymd(store.range.from)
  const to = ymd(store.range.to)
  if (route.query.from === from && route.query.to === to) return
  if (written.size > 50) written.clear()
  written.add(`${from}|${to}`)
  router.replace({ query: { ...route.query, from, to } })
}

const TABS = ['summary', 'commits'] as const
const tab = ref<(typeof TABS)[number]>(loadPref('oo.tab', TABS, 'summary'))
watch(tab, (v) => savePref('oo.tab', v))

readUrl()
onMounted(() => {
  writeUrl()
  store.init()
})
watch(() => store.range, writeUrl)
watch(
  () => [route.query.from, route.query.to],
  ([f, t]) => {
    if (!written.has(`${f}|${t}`)) readUrl()
  },
)
</script>

<template>
  <div class="space-y-4">
    <RangePresets />
    <section class="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p class="px-4 pt-2 text-xs text-slate-500 dark:text-slate-400">
        Drag the handles or the highlighted window to choose a range · scroll over the lanes to zoom
      </p>
      <OverviewChart />
      <div class="border-t border-slate-100 dark:border-slate-800">
        <SwimlaneChart />
      </div>
    </section>
    <RangeStats />
    <div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <RepoList />
      <div class="min-w-0 space-y-3">
        <div class="flex gap-1 border-b border-slate-200 dark:border-slate-800" role="tablist">
          <button
            v-for="t in TABS"
            :key="t"
            role="tab"
            :aria-selected="tab === t"
            class="-mb-px border-b-2 px-4 py-2 text-sm font-medium"
            :class="tab === t ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'"
            @click="tab = t"
          >
            {{ t === 'summary' ? 'Summary' : `Commits (${store.commitsInRange.length})` }}
          </button>
        </div>
        <SummaryPanel v-if="tab === 'summary'" />
        <CommitList v-else />
      </div>
    </div>
  </div>
</template>
