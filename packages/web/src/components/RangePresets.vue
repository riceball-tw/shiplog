<script setup lang="ts">
import { computed } from 'vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppStore } from '../stores/app'
import { type PresetKey, presetRange, ymd } from '../lib/dates'

const store = useAppStore()
const presets: { key: PresetKey; label: string }[] = [
  { key: 'twoWeeks', label: 'Last 2 weeks' },
  { key: 'month', label: 'This month' },
  { key: 'threeMonths', label: 'Last 3 months' },
  { key: 'all', label: 'All' },
]
const ctx = computed(() => ({ allFrom: store.extent.from }))
const ranges = computed(() => new Map(presets.map((p) => [p.key, presetRange(p.key, ctx.value)])))
const active = computed(() => {
  const { from, to } = store.range
  for (const p of presets) {
    const r = ranges.value.get(p.key)
    if (r && ymd(r.from) === ymd(from) && ymd(r.to) === ymd(to)) return p.key
  }
  return null
})

function pick(key: PresetKey) {
  const r = ranges.value.get(key)
  if (r) store.setRange(r)
}
</script>

<template>
  <ToggleGroup
    type="single" variant="outline" size="sm" aria-label="Range presets"
    :model-value="active ?? ''"
    @update:model-value="(v) => v && pick(v as PresetKey)"
  >
    <ToggleGroupItem v-for="p in presets" :key="p.key" :value="p.key" :disabled="!ranges.get(p.key)" class="px-2.5 text-xs">
      {{ p.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
