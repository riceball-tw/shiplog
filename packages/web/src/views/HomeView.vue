<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { dayEnd, parseYmd, ymd } from '../lib/dates'
import RangePresets from '../components/RangePresets.vue'
import OverviewChart from '../components/OverviewChart.vue'
import SwimlaneChart from '../components/SwimlaneChart.vue'
import RangeStats from '../components/RangeStats.vue'
import RepoList from '../components/RepoList.vue'
import CommitList from '../components/CommitList.vue'

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
      <CommitList />
    </div>
  </div>
</template>
