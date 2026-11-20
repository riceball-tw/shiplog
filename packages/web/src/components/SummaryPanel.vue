<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CommitType } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { fmtShort, rangeLabel } from '../lib/dates'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown, TYPE_LABELS, type Item } from '../lib/summary'
import { prefersDark } from '../lib/theme'
import TypeBadge from './TypeBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChevronDown, ChevronRight } from '@lucide/vue'

const GROUPS = ['ticket', 'type', 'repo'] as const
type GroupBy = (typeof GROUPS)[number]
const GROUP_LABELS: Record<GroupBy, string> = { ticket: 'Ticket', type: 'Type', repo: 'Repo' }

const store = useAppStore()
const groupBy = ref<GroupBy>(loadPref('oo.summary.groupBy', GROUPS, 'ticket'))
const hideNoise = ref(loadPref('oo.summary.hideNoise', ['1', '0'] as const, '1') === '1')
watch(groupBy, (v) => savePref('oo.summary.groupBy', v))
watch(hideNoise, (v) => savePref('oo.summary.hideNoise', v ? '1' : '0'))

const summary = computed(() => summarize(store.commitsInRange, { hideNoise: hideNoise.value }))
const repoNames = computed(() => Object.fromEntries(store.repos.map((r) => [r.id, r.name])))
const repoName = (id: string) => repoNames.value[id] ?? id
const markdown = computed(() =>
  toMarkdown(summary.value, {
    rangeLabel: rangeLabel(store.range),
    groupBy: groupBy.value === 'ticket' ? 'ticket' : 'type',
    repoNames: repoNames.value,
  }),
)
const nf = (n: number) => n.toLocaleString()
const color = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}
const span = (a: number, b: number) => (fmtShort(a) === fmtShort(b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`)
const typeCounts = (items: Item[]) => {
  const m = new Map<CommitType, number>()
  for (const i of items) m.set(i.commit.classification.type, (m.get(i.commit.classification.type) ?? 0) + 1)
  return [...m]
}

// expand state for ticket rows
const open = ref(new Set<string>())
const toggle = (k: string) => {
  const s = new Set(open.value)
  if (!s.delete(k)) s.add(k)
  open.value = s
}
watch(() => store.commitsInRange, () => (open.value = new Set()))

const showPreview = ref(false)
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(markdown.value)
  } catch {
    // clipboard API unavailable (non-secure context): fall back to a hidden textarea
    const ta = document.createElement('textarea')
    ta.value = markdown.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <Card class="@container gap-0 py-0" data-testid="summary">
    <!-- controls -->
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
      <div class="flex items-center gap-2 text-sm">
        <Checkbox id="hide-noise" v-model="hideNoise" />
        <Label for="hide-noise" class="cursor-pointer font-normal">Hide noise (chore/ci/style/build)</Label>
      </div>
      <Button class="ml-auto" size="sm" :disabled="!summary.totals.commits" @click="copy">
        {{ copied ? 'Copied ✓' : 'Copy as Markdown' }}
      </Button>
    </div>

    <Alert v-if="store.error" variant="destructive" class="m-4 w-auto">
      <AlertDescription>{{ store.error }}</AlertDescription>
    </Alert>
    <p v-else-if="store.loading" class="p-4 text-sm text-muted-foreground">Loading…</p>
    <p v-else-if="!summary.totals.commits" class="p-4 text-sm text-muted-foreground">No commits in this range. Try a wider range or Rescan.</p>
    <div v-else class="space-y-5 p-4">
      <!-- range totals live in the timeline header; only the filter's effect is reported here -->
      <p v-if="summary.totals.noiseHidden" class="text-sm text-muted-foreground">
        {{ nf(summary.totals.noiseHidden) }} noise {{ summary.totals.noiseHidden === 1 ? 'commit' : 'commits' }} hidden from the lists below
      </p>

      <!-- Ticket view -->
      <ul v-if="groupBy === 'ticket'" class="divide-y rounded-md border">
        <li v-for="g in summary.byTicket" :key="g.key ?? '__none'">
          <button class="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50" :aria-expanded="open.has(g.key ?? '__none')" @click="toggle(g.key ?? '__none')">
            <span class="mt-0.5 w-3 shrink-0 text-muted-foreground">{{ open.has(g.key ?? '__none') ? '▾' : '▸' }}</span>
            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 break-words" :title="g.title">
                <span class="font-mono font-semibold" :class="g.key === null && 'text-muted-foreground'">{{ g.key ?? 'No ticket' }}</span>
                <span v-if="g.key !== null && g.title" class="ml-2">{{ g.title }}</span>
              </span>
              <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                <TypeBadge v-for="[t] in typeCounts(g.items)" :key="t" :type="t" />
                <Badge v-for="r in g.repoIds" :key="r" variant="secondary">
                  <span class="size-2 rounded-sm" :style="{ background: color(r) }" />{{ repoName(r) }}
                </Badge>
                <span>· {{ g.items.length }} {{ g.items.length === 1 ? 'commit' : 'commits' }} · {{ span(g.first, g.last) }}</span>
              </span>
            </span>
          </button>
          <ul v-if="open.has(g.key ?? '__none')" class="space-y-1 bg-muted/40 px-3 py-2 pl-9 text-sm">
            <li v-for="it in g.items" :key="it.commit.repoId + it.commit.hash" class="flex items-center gap-2">
              <span class="w-14 shrink-0 text-xs text-muted-foreground">{{ fmtShort(it.ts) }}</span>
              <TypeBadge class="shrink-0" :type="it.commit.classification.type" />
              <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
              <span v-if="g.key === null && it.commit.classification.scope" class="shrink-0 text-xs text-muted-foreground">{{ it.commit.classification.scope }}</span>
            </li>
          </ul>
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
          <p class="mt-1 text-xs text-muted-foreground">{{ r.commits }} commits</p>
          <div class="mt-2 flex flex-wrap gap-1">
            <TypeBadge v-for="g in r.byType" :key="g.type" :type="g.type">{{ g.type }} {{ g.items.length }}</TypeBadge>
          </div>
          <ul v-if="r.topDirs.length" class="mt-2 space-y-0.5 text-xs text-foreground/80">
            <li v-for="d in r.topDirs.slice(0, 5)" :key="d.dir" class="flex justify-between gap-2">
              <span class="truncate font-mono">{{ d.dir }}</span><span class="shrink-0 text-muted-foreground">{{ nf(d.lines) }} lines</span>
            </li>
          </ul>
        </div>
      </div>

      <!-- Top areas -->
      <div v-if="summary.topDirs.length">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top areas</h3>
        <ul class="grid gap-x-6 gap-y-0.5 text-sm @xl:grid-cols-2">
          <li v-for="d in summary.topDirs" :key="d.repoId + d.dir" class="flex items-center gap-2">
            <span class="size-2 shrink-0 rounded-sm" :style="{ background: color(d.repoId) }" />
            <span class="min-w-0 flex-1 truncate font-mono text-xs" :title="repoName(d.repoId) + ' / ' + d.dir">{{ repoName(d.repoId) }}/{{ d.dir }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{ nf(d.lines) }} lines · {{ d.commits }}c</span>
          </li>
        </ul>
      </div>

      <!-- Markdown preview -->
      <Collapsible v-model:open="showPreview">
        <CollapsibleTrigger as-child>
          <Button variant="link" class="h-auto px-0" :aria-expanded="showPreview">
            <component :is="showPreview ? ChevronDown : ChevronRight" /> Preview markdown
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{{ markdown }}</pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </Card>
</template>
