<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import '../lib/echartsSetup'
import { useAppStore } from '../stores/app'
import { buildOverviewOption, chartTheme, OVERVIEW_HEIGHT } from '../lib/charts'
import { prefersDark } from '../lib/theme'
import { useRangeSync } from '../lib/useRangeSync'

const store = useAppStore()
const chart = ref<InstanceType<typeof VChart> | null>(null)
const { onDataZoom, onFinished, apply } = useRangeSync(chart)

const option = computed(() => {
  const colors = new Map<string, string>()
  for (const [id, c] of store.repoColors) colors.set(id, prefersDark.value ? c.dark : c.light)
  return buildOverviewOption({
    commits: store.visibleCommits,
    repos: store.visibleRepos,
    colors,
    extent: store.extent,
    meetings: store.meetings,
    theme: chartTheme(prefersDark.value),
  })
})

// a rebuilt option must not lose the brush window
watch(option, () => nextTick(() => apply(true)))
</script>

<template>
  <VChart
    ref="chart"
    class="w-full"
    :style="{ height: OVERVIEW_HEIGHT + 'px' }"
    :option="option"
    autoresize
    @datazoom="onDataZoom"
    @finished="onFinished"
  />
</template>
