<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { commitKey } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { rangeLabel, ymd } from '../lib/dates'
import { themeGanttRows } from '../lib/charts'
import { themeGanttMermaid } from '../lib/mermaid'
import { renderMermaid, type Rendered } from '../lib/mermaidImage'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown } from '../lib/summary'
import { groupByTheme } from '../lib/themes'
import { useRepoLookup } from '../lib/useRepoLookup'
import TicketRow from './TicketRow.vue'
import ThemeCard from './ThemeCard.vue'
import AddToTheme from './AddToTheme.vue'
import ThemeNameDialog from './ThemeNameDialog.vue'
import ExportDialog from './ExportDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, Download, Plus, Presentation } from '@lucide/vue'

const store = useAppStore()
const router = useRouter()
const { repoNames, repoName, color } = useRepoLookup()
const present = () => router.push({ path: '/present', query: { from: ymd(store.range.from), to: ymd(store.range.to) } })
const withTimeline = ref(loadPref('oo.summary.mermaid', ['1', '0'] as const, '1') === '1')
watch(withTimeline, (v) => savePref('oo.summary.mermaid', v ? '1' : '0'))

const summary = computed(() => summarize(store.commitsInRange, { hideNoise: store.hideNoise }))
const themed = computed(() => groupByTheme(summary.value.items, store.notes))
const mermaid = computed(() =>
  withTimeline.value
    ? themeGanttMermaid(themeGanttRows(store.keptCommits, store.notes.themes, store.notes.highlights, store.range), store.range, { title: rangeLabel(store.range) })
    : null,
)
const markdown = computed(() =>
  toMarkdown(summary.value, {
    rangeLabel: rangeLabel(store.range),
    groupBy: 'theme',
    repoNames: repoNames.value,
    themes: themed.value,
    mermaid: mermaid.value,
  }),
)
// pele render of the timeline; an error is shown as a muted line instead
const diagram = computed<{ ok: Rendered } | { err: string } | null>(() => {
  if (!mermaid.value) return null
  try {
    return { ok: renderMermaid(mermaid.value) }
  } catch (e) {
    return { err: e instanceof Error ? e.message : String(e) }
  }
})
const showExport = ref(false)

/** theme card order neighbours, so up/down move relative to what is on screen */
const cardIds = computed(() => themed.value.cards.map((c) => c.theme.id))
/** item waiting on the New theme dialog; assigned to the theme once it is created */
const nameDialog = ref(false)
let pending: { tickets?: string[]; commits?: string[] } | null = null
function addTo(themeId: string | null, what: { tickets?: string[]; commits?: string[] }) {
  if (themeId === null) {
    pending = what
    nameDialog.value = true
    return
  }
  store.assign(themeId, what)
}
function newTheme(name: string) {
  const id = store.createTheme(name)
  if (pending) store.assign(id, pending)
  pending = null
}
function openNewTheme() {
  pending = null
  nameDialog.value = true
}
const showEmpty = ref(false)
const nf = (n: number) => n.toLocaleString()
</script>

<template>
  <Card class="gap-0 py-0" data-testid="summary">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-2 border-b px-4 py-3">
      <h2 class="text-sm font-semibold">
        Themes <span v-if="store.notes.themes.length" class="font-normal text-muted-foreground">({{ store.notes.themes.length }})</span>
      </h2>
      <div class="ml-auto flex items-center gap-2">
        <Button size="sm" variant="outline" @click="openNewTheme"><Plus /> New theme</Button>
        <Button size="sm" variant="outline" :disabled="!summary.totals.commits" @click="showExport = true"><Download /> Export</Button>
        <Tooltip>
          <TooltipTrigger as-child>
            <span tabindex="0">
              <Button size="sm" :disabled="!store.keptCommits.length" @click="present"><Presentation /> Present</Button>
            </span>
          </TooltipTrigger>
          <TooltipContent v-if="!store.keptCommits.length" side="bottom">No commits in this range to present</TooltipContent>
        </Tooltip>
      </div>
    </div>

    <Alert v-if="store.notesError" variant="destructive" class="mx-4 mt-4 w-auto" role="alert">
      <AlertDescription class="flex items-center justify-between gap-3">
        <span class="min-w-0">{{ store.notesError }}</span>
        <Button size="sm" variant="outline" class="shrink-0" @click="store.flushNotes()">Retry</Button>
      </AlertDescription>
    </Alert>
    <Alert v-if="store.error" variant="destructive" class="m-4 w-auto">
      <AlertDescription>{{ store.error }}</AlertDescription>
    </Alert>
    <p v-else-if="store.loading" class="p-4 text-sm text-muted-foreground">Loading…</p>
    <div v-else class="space-y-4 p-4">
      <p v-if="!summary.totals.commits" class="text-sm text-muted-foreground">No commits in this range.</p>
      <p v-else-if="summary.totals.noiseHidden" class="text-sm text-muted-foreground">
        {{ nf(summary.totals.noiseHidden) }} noise {{ summary.totals.noiseHidden === 1 ? 'commit' : 'commits' }} hidden from the lists below
      </p>
      <p v-if="!store.notes.themes.length" class="text-sm text-muted-foreground">
        Group tickets into themes — the stories you'll tell in your review.
      </p>
      <ThemeCard
        v-for="(c, i) in themed.cards"
        :key="c.theme.id"
        :theme="c.theme"
        :data="c"
        :color="color"
        :repo-name="repoName"
        :can-up="i > 0"
        :can-down="i < themed.cards.length - 1"
        @up="store.reorderTheme(c.theme.id, cardIds[i - 1]!)"
        @down="store.reorderTheme(c.theme.id, cardIds[i + 1]!)"
      />

      <!-- nothing in range: all themes are "empty", list them directly so they stay editable -->
      <div v-if="!summary.totals.commits" class="space-y-3">
        <ThemeCard
          v-for="(t, i) in themed.empty"
          :key="t.id"
          :theme="t"
          :color="color"
          :repo-name="repoName"
          :can-up="i > 0"
          :can-down="i < themed.empty.length - 1"
          @up="store.reorderTheme(t.id, themed.empty[i - 1]!.id)"
          @down="store.reorderTheme(t.id, themed.empty[i + 1]!.id)"
        />
      </div>
      <Collapsible v-else-if="themed.empty.length" v-model:open="showEmpty" class="space-y-3">
        <CollapsibleTrigger as-child>
          <Button variant="link" class="h-auto px-0 text-muted-foreground" :aria-expanded="showEmpty">
            <component :is="showEmpty ? ChevronDown : ChevronRight" />
            {{ themed.empty.length }} {{ themed.empty.length === 1 ? 'theme' : 'themes' }} with no work in this range
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent class="space-y-3">
          <ThemeCard v-for="t in themed.empty" :key="t.id" :theme="t" :color="color" :repo-name="repoName" :can-up="false" :can-down="false" />
        </CollapsibleContent>
      </Collapsible>

      <section v-if="themed.unassigned.length" aria-label="Unassigned">
        <h3 class="mb-1 text-sm font-semibold">Unassigned <span class="font-normal text-muted-foreground">({{ themed.unassigned.length }})</span></h3>
        <ul class="divide-y rounded-md border">
          <li v-for="g in themed.unassigned" :key="(g.key ?? '__none') + g.repoIds.join()">
            <TicketRow :group="g" :color="color" :repo-name="repoName">
              <template #actions>
                <AddToTheme
                  :themes="store.notes.themes"
                  @pick="(id) => addTo(id, g.key ? { tickets: [g.key] } : { commits: g.items.map((i) => commitKey(i.commit)) })"
                />
              </template>
            </TicketRow>
          </li>
        </ul>
      </section>
    </div>
    <ThemeNameDialog v-model:open="nameDialog" @submit="newTheme" />
    <ExportDialog
      v-model:open="showExport"
      v-model:timeline="withTimeline"
      title="Export story"
      :markdown="markdown"
      :diagram="diagram"
      :file-base="`shiplog-themes-${ymd(store.range.from)}-${ymd(store.range.to)}`"
    />
  </Card>
</template>
