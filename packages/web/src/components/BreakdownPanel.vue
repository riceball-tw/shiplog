<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { commitKey } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { rangeLabel, ymd } from '../lib/dates'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown, TYPE_LABELS } from '../lib/summary'
import { useRepoLookup } from '../lib/useRepoLookup'
import TypeBadge from './TypeBadge.vue'
import TicketRow from './TicketRow.vue'
import ExportDialog from './ExportDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Download, Star } from '@lucide/vue'

const GROUPS = ['ticket', 'type', 'repo'] as const
type GroupBy = (typeof GROUPS)[number]
const GROUP_LABELS: Record<GroupBy, string> = { ticket: 'Ticket', type: 'Type', repo: 'Repo' }

const store = useAppStore()
const { repoNames, repoName, color } = useRepoLookup()
// 'theme' was an option before Story got its own tab: loadPref falls back to ticket
const groupBy = ref<GroupBy>(loadPref('oo.summary.groupBy', GROUPS, 'ticket'))
watch(groupBy, (v) => savePref('oo.summary.groupBy', v))

const summary = computed(() => summarize(store.commitsInRange, { hideNoise: store.hideNoise }))
const markdown = computed(() =>
  toMarkdown(summary.value, {
    rangeLabel: rangeLabel(store.range),
    groupBy: groupBy.value === 'ticket' ? 'ticket' : 'type',
    repoNames: repoNames.value,
  }),
)
const showExport = ref(false)
const starred = (it: { commit: { repoId: string; hash: string } }) => store.isHighlighted(commitKey(it.commit))
const repoStars = (repoId: string) => store.notes.highlights.filter((k) => k.startsWith(repoId + ':')).length
const nf = (n: number) => n.toLocaleString()
</script>

<template>
  <Card class="@container gap-0 py-0" data-testid="breakdown">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3">
      <div class="flex items-center gap-2 text-sm">
        <span class="text-muted-foreground">Group by</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="groupBy"
          @update:model-value="(v) => v && (groupBy = v as GroupBy)"
        >
          <ToggleGroupItem v-for="g in GROUPS" :key="g" :value="g">{{ GROUP_LABELS[g] }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Button class="ml-auto" size="sm" variant="outline" :disabled="!summary.totals.commits" @click="showExport = true"><Download /> Export</Button>
    </div>

    <Alert v-if="store.error" variant="destructive" class="m-4 w-auto">
      <AlertDescription>{{ store.error }}</AlertDescription>
    </Alert>
    <p v-else-if="store.loading" class="p-4 text-sm text-muted-foreground">Loading…</p>
    <p v-else-if="!summary.totals.commits" class="p-4 text-sm text-muted-foreground">No commits in this range. Try a wider range or Rescan.</p>
    <div v-else class="space-y-5 p-4">
      <p v-if="summary.totals.noiseHidden" class="text-sm text-muted-foreground">
        {{ nf(summary.totals.noiseHidden) }} noise {{ summary.totals.noiseHidden === 1 ? 'commit' : 'commits' }} hidden from the lists below
      </p>

      <!-- Ticket view -->
      <ul v-if="groupBy === 'ticket'" class="divide-y rounded-md border">
        <li v-for="g in summary.byTicket" :key="g.key ?? '__none'">
          <TicketRow :group="g" :color="color" :repo-name="repoName" />
        </li>
      </ul>

      <!-- Type view -->
      <div v-else-if="groupBy === 'type'" class="space-y-4">
        <div v-for="g in summary.byType" :key="g.type">
          <h3 class="mb-1 flex items-center gap-2 text-sm font-semibold">
            <TypeBadge :type="g.type" />
            {{ TYPE_LABELS[g.type] }} ({{ g.items.length }})
          </h3>
          <ul class="space-y-0.5 pl-1 text-sm">
            <li v-for="it in g.items" :key="it.commit.repoId + it.commit.hash" class="flex gap-2">
              <Star v-if="starred(it)" class="size-3.5 shrink-0 fill-current text-amber-500" aria-label="Highlighted" />
              <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
              <Badge v-for="t in it.commit.tickets" :key="t" variant="secondary" class="shrink-0">{{ t }}</Badge>
              <span class="shrink-0 text-xs text-muted-foreground">{{ repoName(it.commit.repoId) }}</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Repo view -->
      <div v-else class="grid gap-3 @xl:grid-cols-2 @5xl:grid-cols-3">
        <div v-for="r in summary.byRepo" :key="r.repoId" class="rounded-md border p-3">
          <h3 class="flex items-center gap-2 text-sm font-semibold">
            <span class="size-3 rounded-sm" :style="{ background: color(r.repoId) }" />
            <span class="min-w-0 flex-1 truncate">{{ repoName(r.repoId) }}</span>
            <span class="font-mono text-xs font-normal"><span class="text-emerald-600 dark:text-emerald-400">+{{ nf(r.insertions) }}</span> <span class="text-destructive">−{{ nf(r.deletions) }}</span></span>
          </h3>
          <p class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {{ r.commits }} commits
            <span v-if="repoStars(r.repoId)" class="inline-flex items-center gap-0.5 text-amber-500" :aria-label="`${repoStars(r.repoId)} highlighted`"><Star class="size-3 fill-current" />{{ repoStars(r.repoId) }}</span>
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <TypeBadge v-for="g in r.byType" :key="g.type" :type="g.type">{{ g.type }} {{ g.items.length }}</TypeBadge>
          </div>
        </div>
      </div>
    </div>
    <ExportDialog
      v-model:open="showExport"
      title="Export breakdown"
      :markdown="markdown"
      :file-base="`shiplog-breakdown-${ymd(store.range.from)}-${ymd(store.range.to)}`"
    />
  </Card>
</template>
