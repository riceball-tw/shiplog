<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { dayEnd, parseYmd, ymd } from '../lib/dates'
import RangePresets from '../components/RangePresets.vue'
import OverviewChart from '../components/OverviewChart.vue'
import ThemeGantt from '../components/ThemeGantt.vue'
import SwimlaneChart from '../components/SwimlaneChart.vue'
import RangeStats from '../components/RangeStats.vue'
import ScanButton from '../components/ScanButton.vue'
import CommitList from '../components/CommitList.vue'
import StoryPanel from '../components/StoryPanel.vue'
import BreakdownPanel from '../components/BreakdownPanel.vue'
import SetupGuide from '../components/SetupGuide.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, ChevronRight } from '@lucide/vue'
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

const TABS = ['story', 'breakdown', 'commits'] as const
type Tab = (typeof TABS)[number]
// 'summary' was the old first tab
const tab = ref<Tab>(loadPref('oo.tab', TABS, 'story', { summary: 'story' }))
watch(tab, (v) => savePref('oo.tab', v))
const lanesOpen = ref(loadPref('oo.lanesOpen', ['1', '0'] as const, '0') === '1')
watch(lanesOpen, (v) => savePref('oo.lanesOpen', v ? '1' : '0'))

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

/** first run: nothing to scan or nobody to match -> show the setup checklist instead of an empty timeline */
const needsSetup = computed(() => {
  const c = store.config
  return !!c && ((!c.scanRoots.length && !c.pinnedRepos.length) || !c.authorEmails.length)
})

// clicking a dot in the lanes reveals that commit in the list
watch(
  () => store.selectedKey,
  (k) => {
    if (k) tab.value = 'commits'
  },
)
// clicking a theme row in the timeline jumps to its card
watch(
  () => store.themeFocus,
  (f) => {
    if (f) tab.value = 'story'
  },
)
</script>

<template>
  <Alert v-if="store.error && !store.config" variant="destructive" class="mx-auto max-w-xl">
    <AlertDescription>{{ store.error }}</AlertDescription>
  </Alert>
  <SetupGuide v-else-if="needsSetup" />
  <div v-else class="space-y-4">
    <Card class="gap-0 overflow-hidden py-0" data-testid="timeline">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-2.5">
        <RangeStats />
        <div class="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger as-child>
              <div class="flex items-center gap-1.5 text-xs">
                <Checkbox id="hide-noise" v-model="store.hideNoise" />
                <Label for="hide-noise" class="cursor-pointer text-xs font-normal">Hide noise</Label>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">chore · ci · style · build</TooltipContent>
          </Tooltip>
          <RangePresets />
          <ScanButton />
        </div>
      </div>
      <OverviewChart />
      <div class="border-t">
        <ThemeGantt />
      </div>
      <Collapsible v-model:open="lanesOpen" class="border-t">
        <CollapsibleTrigger as-child>
          <button class="flex w-full items-center gap-1 px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50" :aria-expanded="lanesOpen">
            <component :is="lanesOpen ? ChevronDown : ChevronRight" class="size-4" />
            Repo lanes
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent><SwimlaneChart /></CollapsibleContent>
      </Collapsible>
    </Card>

    <!-- commits are evidence, not needed while telling the story: their own tab, so Story gets the full width -->
    <Tabs v-model="tab" data-testid="results">
      <TabsList variant="line" class="w-full justify-start border-b">
        <TabsTrigger value="story">Story</TabsTrigger>
        <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        <TabsTrigger value="commits">Commits ({{ store.commitsInRange.length }})</TabsTrigger>
      </TabsList>
      <TabsContent value="story" class="mt-3"><StoryPanel /></TabsContent>
      <TabsContent value="breakdown" class="mt-3"><BreakdownPanel /></TabsContent>
      <TabsContent value="commits" class="mt-3"><CommitList /></TabsContent>
    </Tabs>
  </div>
</template>
