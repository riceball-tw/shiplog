<script setup lang="ts">
import { computed } from 'vue'
import type { GanttRow } from '../lib/charts'
import type { Range } from '../stores/app'

/** One thin timeline row for a theme across the range: span, activity density, starred commits. */
const props = defineProps<{ row: GanttRow; range: Range; color: string }>()

const total = computed(() => Math.max(1, props.range.to - props.range.from))
const pct = (t: number) => Math.min(100, Math.max(0, ((t - props.range.from) / total.value) * 100))
const maxCount = computed(() => Math.max(1, ...props.row.buckets.map((b) => b.count)))
</script>

<template>
  <div class="relative h-6 w-full rounded-full bg-muted" aria-hidden="true">
    <div
      class="absolute inset-y-0 min-w-1.5 rounded-full opacity-25"
      :style="{ left: pct(row.first) + '%', width: pct(row.last) - pct(row.first) + '%', background: color }"
    />
    <div
      v-for="b in row.buckets"
      :key="b.start"
      class="absolute inset-y-1 min-w-1 rounded-full"
      :style="{ left: pct(b.start) + '%', width: pct(b.end) - pct(b.start) + '%', background: color, opacity: 0.4 + 0.6 * (b.count / maxCount) }"
    />
    <svg
      v-for="ts in row.stars"
      :key="ts"
      viewBox="0 0 24 24"
      class="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 fill-amber-400 stroke-background"
      :style="{ left: pct(ts) + '%' }"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  </div>
</template>
