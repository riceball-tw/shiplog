<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { prefersDark } from '../lib/theme'

const store = useAppStore()
const counts = computed(() => {
  const m = new Map<string, number>()
  for (const c of store.commitsInRange) m.set(c.repoId, (m.get(c.repoId) ?? 0) + 1)
  return m
})
const color = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Repos ({{ store.repos.length }})
    </h2>
    <p v-if="!store.repos.length" class="text-sm text-slate-500">No repos yet — configure scanRoots and Rescan.</p>
    <ul class="space-y-2">
      <li v-for="r in store.sortedRepos" :key="r.id">
        <label class="flex items-start gap-2 text-sm" :class="r.included ? 'cursor-pointer' : 'cursor-not-allowed'">
          <input
            type="checkbox"
            class="mt-1 size-4 shrink-0 accent-indigo-600"
            :checked="r.included && !store.hiddenRepoIds.includes(r.id)"
            :disabled="!r.included"
            @change="store.toggleRepo(r.id)"
          />
          <span class="mt-1.5 size-3 shrink-0 rounded-sm" :style="{ background: r.included ? color(r.id) : 'transparent', border: r.included ? 'none' : '1px dashed #94a3b8' }" />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate font-medium" :class="(!r.included || store.hiddenRepoIds.includes(r.id)) && 'text-slate-400 line-through'">{{ r.name }}</span>
              <span v-if="r.included" class="shrink-0 font-mono text-xs text-slate-500 dark:text-slate-400" title="Commits in range">{{ counts.get(r.id) ?? 0 }}</span>
              <span v-else class="shrink-0 text-xs text-slate-400">excluded</span>
            </span>
            <span class="block truncate text-xs text-slate-500 dark:text-slate-400" :title="r.path">{{ r.path }}</span>
          </span>
        </label>
      </li>
    </ul>
  </section>
</template>
