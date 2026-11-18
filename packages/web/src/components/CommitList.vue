<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import TypeBadge from './TypeBadge.vue'

const store = useAppStore()
const repoName = computed(() => new Map(store.repos.map((r) => [r.id, r.name])))
const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
      Commits ({{ store.commits.length }})
    </h2>
    <div v-if="store.error" class="m-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {{ store.error }}
    </div>
    <p v-else-if="store.loading" class="p-4 text-sm text-slate-500">Loading…</p>
    <p v-else-if="!store.commits.length" class="p-4 text-sm text-slate-500">
      No commits in this range. Try a wider range or Rescan.
    </p>
    <ul v-else class="divide-y divide-slate-100 dark:divide-slate-800">
      <li v-for="c in store.commits" :key="c.repoId + c.hash" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <span class="w-14 shrink-0 text-slate-500 dark:text-slate-400">{{ fmt(c.date) }}</span>
        <span class="w-32 shrink-0 truncate text-slate-600 dark:text-slate-300">{{ repoName.get(c.repoId) ?? c.repoId }}</span>
        <TypeBadge :classification="c.classification" />
        <span class="min-w-0 flex-1 truncate" :title="c.subject">{{ c.subject }}</span>
        <span v-for="t in c.tickets" :key="t" class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{{ t }}</span>
        <span class="shrink-0 font-mono text-xs">
          <span class="text-emerald-600 dark:text-emerald-400">+{{ c.insertions }}</span>
          <span class="ml-1 text-red-600 dark:text-red-400">-{{ c.deletions }}</span>
        </span>
      </li>
    </ul>
  </section>
</template>
