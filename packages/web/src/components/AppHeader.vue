<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const result = computed(() => store.lastScan)
</script>

<template>
  <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
      <h1 class="text-lg font-semibold">One-on-One</h1>
      <div class="ml-auto flex items-center gap-3 text-sm">
        <span v-if="result" class="text-slate-500 dark:text-slate-400">
          {{ result.newCommits }} new commits in {{ result.durationMs }} ms
          <span v-if="result.errors.length" class="text-red-600 dark:text-red-400"
            :title="result.errors.map((e) => `${e.repoPath}: ${e.message}`).join('\n')">
            · {{ result.errors.length }} errors
          </span>
        </span>
        <button
          class="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          :disabled="store.scanning"
          @click="store.scan()"
        >
          <svg v-if="store.scanning" class="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" />
          </svg>
          {{ store.scanning ? 'Scanning…' : 'Rescan' }}
        </button>
      </div>
    </div>
  </header>
</template>
