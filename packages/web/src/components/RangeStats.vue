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
  <div class="flex min-w-0 flex-wrap items-baseline gap-x-5 gap-y-1">
     <h2 class="text-base font-semibold tracking-tight" data-testid="range-label">{{ rangeLabel(store.range, stats.days) }}</h2>
    <dl class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/80">
      <div><dt class="inline text-muted-foreground">Commits </dt><dd class="inline font-semibold tabular-nums">{{ nf(stats.commits) }}</dd></div>
      <div><dt class="inline text-muted-foreground">Repos </dt><dd class="inline font-semibold tabular-nums">{{ stats.repos }}</dd></div>
      <div>
        <dt class="inline text-muted-foreground">Lines </dt>
        <dd class="inline font-mono font-semibold">
          <span class="text-emerald-600 dark:text-emerald-400">+{{ nf(stats.ins) }}</span>
          <span class="ml-1 text-red-600 dark:text-red-400">−{{ nf(stats.del) }}</span>
        </dd>
      </div>
    </dl>
  </div>
</template>
