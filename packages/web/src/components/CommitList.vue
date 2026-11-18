<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { commitKey, useAppStore, type TimedCommit } from '../stores/app'
import TypeBadge from './TypeBadge.vue'

const PAGE = 300
const store = useAppStore()
const limit = ref(PAGE)
const repoName = computed(() => new Map(store.repos.map((r) => [r.id, r.name])))
const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const dayLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

const groups = computed(() => {
  const out: { key: string; label: string; items: TimedCommit[] }[] = []
  for (const c of store.commitsInRange.slice(0, limit.value)) {
    const label = dayLabel(c.ts)
    const last = out.at(-1)
    if (last && last.label === label) last.items.push(c)
    else out.push({ key: label, label, items: [c] })
  }
  return out
})
const remaining = computed(() => Math.max(0, store.commitsInRange.length - limit.value))

watch(() => store.commitsInRange, () => (limit.value = PAGE))

watch(
  () => store.selectedKey,
  async (key) => {
    if (!key) return
    const idx = store.commitsInRange.findIndex((c) => commitKey(c) === key)
    if (idx < 0) return
    if (idx >= limit.value) limit.value = idx + 1
    await nextTick()
    document.getElementById('commit-' + key.replace(':', '-'))?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  },
)
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <h2 class="border-b border-slate-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
      Commits ({{ store.commitsInRange.length }})
    </h2>
    <div v-if="store.error" class="m-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {{ store.error }}
    </div>
    <p v-else-if="store.loading" class="p-4 text-sm text-slate-500">Loading…</p>
    <p v-else-if="!store.commitsInRange.length" class="p-4 text-sm text-slate-500">
      No commits in this range. Try a wider range or Rescan.
    </p>
    <div v-else>
      <div v-for="g in groups" :key="g.key">
        <h3 class="bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">{{ g.label }}</h3>
        <ul class="divide-y divide-slate-100 dark:divide-slate-800">
          <li
            v-for="c in g.items"
            :id="'commit-' + c.repoId + '-' + c.hash"
            :key="c.repoId + c.hash"
            class="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
            :class="store.selectedKey === commitKey(c) ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'"
            @click="store.select(c)"
          >
            <span class="w-20 shrink-0 whitespace-nowrap text-slate-500 dark:text-slate-400">{{ time(c.ts) }}</span>
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
      </div>
      <button
        v-if="remaining"
        class="w-full border-t border-slate-200 px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-slate-50 dark:border-slate-800 dark:text-indigo-400 dark:hover:bg-slate-800/50"
        @click="limit += PAGE"
      >
        Show more ({{ remaining }} remaining)
      </button>
    </div>
  </section>
</template>
