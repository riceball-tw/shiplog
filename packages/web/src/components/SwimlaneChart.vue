<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import '../lib/echartsSetup'
import { useAppStore } from '../stores/app'
import { buildSwimlaneOption, chartTheme, swimlaneHeight } from '../lib/charts'
import { prefersDark } from '../lib/theme'
import { useRangeSync } from '../lib/useRangeSync'

const store = useAppStore()
const chart = ref<InstanceType<typeof VChart> | null>(null)
const { onDataZoom, onFinished, apply } = useRangeSync(chart)

const option = computed(() =>
  buildSwimlaneOption({
    commits: store.visibleCommits,
    lanes: store.visibleRepos,
    extent: store.extent,
    selectedKey: store.selectedKey,
    theme: chartTheme(prefersDark.value),
  }),
)
const height = computed(() => swimlaneHeight(store.visibleRepos.length))

watch(option, () => nextTick(() => apply(true)))

function onClick(p: any) {
  if (p?.seriesName === 'commits' && p.data?.hash) store.select({ repoId: p.data.repoId, hash: p.data.hash })
}
</script>

<template>
  <p v-if="!store.visibleRepos.length" class="px-4 py-8 text-center text-sm text-slate-500">No repos visible.</p>
  <VChart
    v-else
    ref="chart"
    class="w-full"
    :style="{ height: height + 'px' }"
    :option="option"
    autoresize
    @datazoom="onDataZoom"
    @finished="onFinished"
    @click="onClick"
  />
</template>
