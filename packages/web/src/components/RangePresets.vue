<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { useAppStore } from '../stores/app'
import { type PresetKey, presetRange, ymd } from '../lib/dates'

const store = useAppStore()
const presets: { key: PresetKey; label: string }[] = [
  { key: 'twoWeeks', label: 'Last 2 weeks' },
  { key: 'month', label: 'This month' },
  { key: 'threeMonths', label: 'Last 3 months' },
  { key: 'sinceMeeting', label: 'Since last 1:1' },
  { key: 'all', label: 'All' },
]
const ctx = computed(() => ({ meetings: store.meetings, allFrom: store.extent.from }))
const ranges = computed(() => new Map(presets.map((p) => [p.key, presetRange(p.key, ctx.value)])))
const active = computed(() => {
  const { from, to } = store.range
  for (const p of presets) {
    const r = ranges.value.get(p.key)
    if (r && ymd(r.from) === ymd(from) && ymd(r.to) === ymd(to)) return p.key
  }
  return null
})
const today = computed(() => ymd(Date.now()))
const marked = computed(() => store.meetings.includes(today.value))

function pick(key: PresetKey) {
  const r = ranges.value.get(key)
  if (r) store.setRange(r)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <Button
      v-for="p in presets"
      :key="p.key"
      :variant="active === p.key ? 'default' : 'outline'"
      :disabled="!ranges.get(p.key)"
      :title="!ranges.get(p.key) ? 'No past 1:1 meetings recorded yet' : undefined"
      @click="pick(p.key)"
    >
      {{ p.label }}
    </Button>
    <Button
      variant="outline"
      class="ml-auto"
      :disabled="marked"
      :title="marked ? `${today} is already marked` : `Add ${today} to your 1:1 meeting dates`"
      @click="store.markTodayAsMeeting()"
    >
      {{ marked ? 'Today marked as 1:1' : 'Mark today as 1:1' }}
    </Button>
  </div>
</template>
