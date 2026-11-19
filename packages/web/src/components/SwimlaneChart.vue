<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import '../lib/echartsSetup'
import { useAppStore } from '../stores/app'
import { buildSwimlaneOption, chartTheme, swimlaneHeight } from '../lib/charts'
import { prefersDark } from '../lib/theme'
import { COMMIT_TYPE_COLORS } from '../lib/commitTypes'
import { useRangeSync } from '../lib/useRangeSync'

const store = useAppStore()
const chart = ref<InstanceType<typeof VChart> | null>(null)
const { onDataZoom, onFinished, apply } = useRangeSync(chart)

// Only repos with commits in the range get a lane. Debounced so lanes (and the option rebuild,
// which re-applies the store range) don't change while the user is still dragging or zooming.
const LANE_DEBOUNCE_MS = 300
const activeRepoIds = ref(new Set<string>())
const syncLanes = () => (activeRepoIds.value = new Set(store.commitsInRange.map((c) => c.repoId)))
syncLanes()
let laneTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => store.commitsInRange,
  () => {
    if (laneTimer) clearTimeout(laneTimer)
    laneTimer = setTimeout(syncLanes, LANE_DEBOUNCE_MS)
  },
)
onBeforeUnmount(() => laneTimer && clearTimeout(laneTimer))
const lanes = computed(() => store.visibleRepos.filter((r) => activeRepoIds.value.has(r.id)))
const emptyLanes = computed(() => store.visibleRepos.length - lanes.value.length)

const option = computed(() =>
  buildSwimlaneOption({
    commits: store.visibleCommits,
    lanes: lanes.value,
    extent: store.extent,
    selectedKey: store.selectedKey,
    theme: chartTheme(prefersDark.value),
  }),
)
const typesPresent = computed(() => {
  const present = new Set(store.commitsInRange.map((c) => c.classification.type))
  return (Object.keys(COMMIT_TYPE_COLORS) as (keyof typeof COMMIT_TYPE_COLORS)[]).filter((t) => present.has(t))
})
const height = computed(() => swimlaneHeight(lanes.value.length))

watch(option, () => nextTick(() => apply(true)))

// ECharts always preventDefault()s wheel events when wheel-zoom is on, which blocks page scroll.
// Swallow unmodified wheel events before ECharts sees them so the browser scrolls normally.
function onWheelCapture(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
}

function onClick(p: any) {
  if (p?.seriesName === 'commits' && p.data?.hash) store.select({ repoId: p.data.repoId, hash: p.data.hash })
}
</script>

<template>
  <p v-if="!store.visibleRepos.length" class="px-4 py-8 text-center text-sm text-muted-foreground">No repos visible.</p>
  <template v-else>
    <div v-if="typesPresent.length" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 pt-2 text-xs text-muted-foreground">
      <span v-for="t in typesPresent" :key="t" class="inline-flex items-center gap-1">
        <span class="size-2.5 rounded-full" :style="{ background: COMMIT_TYPE_COLORS[t].hex }" />{{ t }}
      </span>
      <span class="text-muted-foreground">· faded dots = low-confidence (guessed) type</span>
      <span v-if="emptyLanes" class="text-muted-foreground">· {{ emptyLanes }} repo{{ emptyLanes === 1 ? '' : 's' }} with no commits in range hidden</span>
    </div>
    <div @wheel.capture="onWheelCapture">
      <VChart
        ref="chart"
        class="w-full"
        :style="{ height: height + 'px' }"
        :option="option"
        autoresize
        @datazoom="onDataZoom"
        @finished="onFinished"
        @click="onClick"
      />
    </div>
  </template>
</template>
