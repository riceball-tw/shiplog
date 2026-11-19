<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  <Card>
    <CardHeader>
      <CardTitle class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Repos ({{ store.repos.length }})
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p v-if="!store.repos.length" class="text-sm text-muted-foreground">No repos yet — configure scanRoots and Rescan.</p>
      <ul class="space-y-2">
        <li v-for="r in store.sortedRepos" :key="r.id">
          <label class="flex items-start gap-2 text-sm" :class="r.included ? 'cursor-pointer' : 'cursor-not-allowed'">
            <Checkbox
              class="mt-1"
              :model-value="r.included && !store.hiddenRepoIds.includes(r.id)"
              :disabled="!r.included"
              @update:model-value="store.toggleRepo(r.id)"
            />
            <span class="mt-1.5 size-3 shrink-0 rounded-sm" :style="{ background: r.included ? color(r.id) : 'transparent', border: r.included ? 'none' : '1px dashed #94a3b8' }" />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="truncate font-medium" :class="(!r.included || store.hiddenRepoIds.includes(r.id)) && 'text-muted-foreground line-through'">{{ r.name }}</span>
                <span v-if="r.included" class="shrink-0 font-mono text-xs text-muted-foreground" title="Commits in range">{{ counts.get(r.id) ?? 0 }}</span>
                <span v-else class="shrink-0 text-xs text-muted-foreground">excluded</span>
              </span>
              <span class="block truncate text-xs text-muted-foreground" :title="r.path">{{ r.path }}</span>
            </span>
          </label>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
