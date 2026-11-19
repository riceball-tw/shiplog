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
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
const tab = ref<string>(loadPref('oo.tab', TABS, 'summary'))
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
    <Card class="gap-0 overflow-hidden py-0">
      <p class="px-4 pt-2 text-xs text-muted-foreground">
        Drag the handles or the highlighted window to choose a range · ⌘/Ctrl + scroll over the lanes to zoom
      </p>
      <OverviewChart />
      <div class="border-t">
        <SwimlaneChart />
      </div>
    </Card>
    <RangeStats />
    <div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <RepoList />
      <div class="min-w-0 space-y-3">
        <Tabs v-model="tab">
          <TabsList variant="line" class="w-full justify-start border-b">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="commits">Commits ({{ store.commitsInRange.length }})</TabsTrigger>
          </TabsList>
          <TabsContent value="summary" class="mt-3"><SummaryPanel /></TabsContent>
          <TabsContent value="commits" class="mt-3"><CommitList /></TabsContent>
        </Tabs>
      </div>
    </div>
  </div>
</template>
