<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import '../lib/echartsSetup'
import { useAppStore } from '../stores/app'
import { buildThemeGanttOption, chartTheme, OTHER_ROW_ID, themeGanttHeight, themeGanttRows } from '../lib/charts'
import { CATEGORICAL, OTHER_COLOR, prefersDark } from '../lib/theme'

const store = useAppStore()
const rows = computed(() => themeGanttRows(store.keptCommits, store.notes.themes, store.notes.highlights, store.range))
const option = computed(() => {
  const dark = prefersDark.value
  return buildThemeGanttOption({
    rows: rows.value,
    range: store.range,
    colors: dark ? CATEGORICAL.dark : CATEGORICAL.light,
    otherColor: dark ? OTHER_COLOR.dark : OTHER_COLOR.light,
    theme: chartTheme(dark),
  })
})
const height = computed(() => themeGanttHeight(rows.value.length))

function onClick(p: any) {
  const id: string | undefined = p?.componentType === 'yAxis' ? p.value : rows.value[p?.data?.row]?.id
  if (id && id !== OTHER_ROW_ID) store.focusTheme(id)
}
</script>

<template>
  <p v-if="!store.notes.themes.length" class="px-4 py-3 text-sm text-muted-foreground">
    No themes yet — group tickets into themes in the summary below.
  </p>
  <p v-else-if="!rows.length" class="px-4 py-3 text-sm text-muted-foreground">No theme work in this range.</p>
  <VChart v-else class="w-full cursor-pointer" :style="{ height: height + 'px' }" :option="option" autoresize @click="onClick" />
</template>
