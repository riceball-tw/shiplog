<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()
const result = computed(() => store.lastScan)
</script>

<template>
  <header class="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
      <RouterLink to="/" class="text-lg font-semibold">One-on-One</RouterLink>
      <RouterLink
        v-if="$route.path !== '/'"
        to="/"
        class="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← Timeline
      </RouterLink>
      <div class="ml-auto flex items-center gap-3 text-sm">
        <span v-if="result" class="text-slate-500 dark:text-slate-400">
          {{ result.newCommits }} new commits in {{ result.durationMs }} ms
          <span v-if="result.errors.length" class="text-red-600 dark:text-red-400"
            :title="result.errors.map((e) => `${e.repoPath}: ${e.message}`).join('\n')">
            · {{ result.errors.length }} errors
          </span>
        </span>
        <RouterLink
          to="/settings"
          class="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          :class="{ 'bg-slate-100 dark:bg-slate-800': $route.path === '/settings' }"
          title="Settings"
        >
          <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          Settings
        </RouterLink>
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
