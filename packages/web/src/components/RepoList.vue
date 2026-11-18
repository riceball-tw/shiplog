<script setup lang="ts">
import { useAppStore } from '../stores/app'

const store = useAppStore()
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      Repos ({{ store.repos.length }})
    </h2>
    <p v-if="!store.repos.length" class="text-sm text-slate-500">No repos yet — configure scanRoots and Rescan.</p>
    <ul class="space-y-2">
      <li v-for="r in store.repos" :key="r.id" class="flex items-start gap-2 text-sm">
        <span
          class="mt-1.5 size-2 shrink-0 rounded-full"
          :class="r.included ? 'bg-emerald-500' : 'bg-slate-400'"
          :title="r.included ? 'Included' : 'Excluded'"
        />
        <div class="min-w-0">
          <div class="font-medium" :class="!r.included && 'text-slate-400 line-through'">{{ r.name }}</div>
          <div class="truncate text-xs text-slate-500 dark:text-slate-400" :title="r.path">{{ r.path }}</div>
        </div>
      </li>
    </ul>
  </section>
</template>
