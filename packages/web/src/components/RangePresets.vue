<script setup lang="ts">
import { ref } from 'vue'
import { presetRange, useAppStore } from '../stores/app'

const store = useAppStore()
const presets = [
  { key: 'twoWeeks', label: 'Last 2 weeks' },
  { key: 'month', label: 'This month' },
  { key: 'threeMonths', label: 'Last 3 months' },
] as const
const active = ref<string>('twoWeeks')

function pick(key: (typeof presets)[number]['key']) {
  active.value = key
  store.setRange(presetRange(key))
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="p in presets"
      :key="p.key"
      class="rounded-md border px-3 py-1.5 text-sm"
      :class="active === p.key
        ? 'border-indigo-600 bg-indigo-600 text-white'
        : 'border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'"
      @click="pick(p.key)"
    >
      {{ p.label }}
    </button>
  </div>
</template>
