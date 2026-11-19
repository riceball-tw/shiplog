<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { commitKey, useAppStore, type TimedCommit } from '../stores/app'
import TypeBadge from './TypeBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
  <Card class="gap-0 py-0">
    <h2 class="border-b px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      Commits ({{ store.commitsInRange.length }})
    </h2>
    <Alert v-if="store.error" variant="destructive" class="m-4 w-auto">
      <AlertDescription>{{ store.error }}</AlertDescription>
    </Alert>
    <p v-else-if="store.loading" class="p-4 text-sm text-muted-foreground">Loading…</p>
    <p v-else-if="!store.commitsInRange.length" class="p-4 text-sm text-muted-foreground">
      No commits in this range. Try a wider range or Rescan.
    </p>
    <div v-else>
      <div v-for="g in groups" :key="g.key">
        <h3 class="bg-muted/50 px-4 py-1.5 text-xs font-semibold text-muted-foreground">{{ g.label }}</h3>
        <ul class="divide-y">
          <li
            v-for="c in g.items"
            :id="'commit-' + c.repoId + '-' + c.hash"
            :key="c.repoId + c.hash"
            class="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
            :class="store.selectedKey === commitKey(c) ? 'bg-accent ring-2 ring-inset ring-ring' : 'hover:bg-muted/50'"
            @click="store.select(c)"
          >
            <span class="w-20 shrink-0 whitespace-nowrap text-muted-foreground">{{ time(c.ts) }}</span>
            <span class="w-32 shrink-0 truncate text-foreground/80">{{ repoName.get(c.repoId) ?? c.repoId }}</span>
            <TypeBadge :classification="c.classification" />
            <span class="min-w-0 flex-1 truncate" :title="c.subject">{{ c.subject }}</span>
            <Badge v-for="t in c.tickets" :key="t" variant="secondary">{{ t }}</Badge>
            <span class="shrink-0 font-mono text-xs">
              <span class="text-emerald-600 dark:text-emerald-400">+{{ c.insertions }}</span>
              <span class="ml-1 text-destructive">-{{ c.deletions }}</span>
            </span>
          </li>
        </ul>
      </div>
      <Button v-if="remaining" variant="ghost" class="h-11 w-full rounded-none border-t text-primary" @click="limit += PAGE">
        Show more ({{ remaining }} remaining)
      </Button>
    </div>
  </Card>
</template>
