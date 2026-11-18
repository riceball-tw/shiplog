<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { rangeLabel, ymd } from '../lib/dates'

const store = useAppStore()
const stats = computed(() => {
  const cs = store.commitsInRange
  let ins = 0
  let del = 0
  const repos = new Set<string>()
  const days = new Set<string>()
  for (const c of cs) {
    ins += c.insertions
    del += c.deletions
    repos.add(c.repoId)
    days.add(ymd(c.ts))
  }
  return { commits: cs.length, repos: repos.size, ins, del, days: days.size }
})
const nf = (n: number) => n.toLocaleString()
</script>

<template>
  <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="text-base font-semibold">{{ rangeLabel(store.range) }}</h2>
    <dl class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
      <div><dt class="inline text-slate-500 dark:text-slate-400">Commits </dt><dd class="inline font-semibold">{{ nf(stats.commits) }}</dd></div>
      <div><dt class="inline text-slate-500 dark:text-slate-400">Repos </dt><dd class="inline font-semibold">{{ stats.repos }}</dd></div>
      <div>
        <dt class="inline text-slate-500 dark:text-slate-400">Lines </dt>
        <dd class="inline font-mono font-semibold">
          <span class="text-emerald-600 dark:text-emerald-400">+{{ nf(stats.ins) }}</span>
          <span class="ml-1 text-red-600 dark:text-red-400">−{{ nf(stats.del) }}</span>
        </dd>
      </div>
      <div><dt class="inline text-slate-500 dark:text-slate-400">Active days </dt><dd class="inline font-semibold">{{ stats.days }}</dd></div>
    </dl>
  </div>
</template>
