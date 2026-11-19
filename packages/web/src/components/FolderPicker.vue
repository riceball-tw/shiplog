<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { DirListing } from '@one-on-one/shared'
import * as api from '../api'

const props = defineProps<{ title?: string; initialPath?: string }>()
const emit = defineEmits<{ select: [path: string]; close: [] }>()

const listing = ref<DirListing | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0

async function go(path?: string): Promise<boolean> {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const l = await api.listDir(path)
    if (mine !== seq) return true
    listing.value = l
    return true
  } catch (e) {
    if (mine === seq) error.value = e instanceof Error ? e.message : String(e)
    return false
  } finally {
    if (mine === seq) loading.value = false
  }
}

const crumbs = computed(() => {
  const p = listing.value?.path
  if (!p) return []
  const parts = p.split('/').filter(Boolean)
  return [{ label: '/', path: '/' }, ...parts.map((name, i) => ({ label: name, path: '/' + parts.slice(0, i + 1).join('/') }))]
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  const start = props.initialPath?.trim()
  // fall back to home when the typed value is not a valid dir
  if (!start || !(await go(start))) await go()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

const btn =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50'
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    role="dialog" aria-modal="true" :aria-label="title ?? 'Choose a folder'"
    @mousedown.self="emit('close')"
  >
    <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div class="border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 class="text-base font-semibold">{{ title ?? 'Choose a folder' }}</h2>
        <nav class="mt-2 flex flex-wrap items-center gap-0.5 font-mono text-sm" aria-label="Current path">
          <template v-for="(c, i) in crumbs" :key="c.path">
            <span v-if="i > 1" class="text-slate-400">/</span>
            <button
              class="rounded px-1 hover:bg-slate-100 dark:hover:bg-slate-800"
              :class="i === crumbs.length - 1 ? 'font-semibold' : 'text-indigo-600 dark:text-indigo-400'"
              @click="go(c.path)"
            >
              {{ c.label }}
            </button>
          </template>
        </nav>
        <div class="mt-3 flex gap-2">
          <button :class="btn" :disabled="!listing?.parent || loading" @click="go(listing!.parent!)">↑ Up</button>
          <button :class="btn" :disabled="loading" @click="go(listing?.home)">Home</button>
        </div>
      </div>

      <div class="min-h-48 flex-1 overflow-auto p-2">
        <p v-if="error" class="m-2 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">
          {{ error }}
        </p>
        <p v-if="loading && !listing" class="p-2 text-sm text-slate-500">Loading…</p>
        <ul v-if="listing" :class="loading ? 'opacity-50' : ''">
          <li v-for="e in listing.entries" :key="e.path">
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="go(e.path)"
            >
              <span aria-hidden="true">📁</span>
              <span class="truncate">{{ e.name }}</span>
              <span v-if="e.isGitRepo" class="rounded bg-emerald-100 px-1.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">git</span>
            </button>
          </li>
          <li v-if="!listing.entries.length && !loading" class="p-2 text-sm text-slate-500">No subfolders.</li>
        </ul>
      </div>

      <div class="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
        <span class="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 dark:text-slate-400" :title="listing?.path">{{ listing?.path }}</span>
        <button :class="btn" @click="emit('close')">Cancel</button>
        <button
          class="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="!listing || loading" @click="emit('select', listing!.path)"
        >
          Select this folder
        </button>
      </div>
    </div>
  </div>
</template>
