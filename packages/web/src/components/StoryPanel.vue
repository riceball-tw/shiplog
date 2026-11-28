<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import { createReusableTemplate, useElementSize } from '@vueuse/core'
import { useRouter } from 'vue-router'
import type { Notes } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { rangeLabel, ymd } from '../lib/dates'
import { themeGanttRows } from '../lib/charts'
import { themeGanttMermaid } from '../lib/mermaid'
import { renderMermaid, type Rendered } from '../lib/mermaidImage'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown } from '../lib/summary'
import { groupByTheme } from '../lib/themes'
import { useRepoLookup } from '../lib/useRepoLookup'
import type { WorkUnit } from '../lib/workDrag'
import { drag } from '../lib/useWorkDrag'
import UnassignedInbox from './UnassignedInbox.vue'
import ThemeDropZone from './ThemeDropZone.vue'
import ThemeCard from './ThemeCard.vue'
import ThemeNameDialog from './ThemeNameDialog.vue'
import ExportDialog from './ExportDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
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
/** work waiting on the New theme dialog; moved into the theme once it is created */
const nameDialog = ref(false)
let pending: WorkUnit[] | null = null
const themeName = (id: string) => store.notes.themes.find((t) => t.id === id)?.name || 'Untitled theme'
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

// undo bar: remembers the notes from before the last drag/key move for ~5s
const toast = ref<{ text: string; snapshot: Notes } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
function flash(text: string, snapshot: Notes) {
  toast.value = { text, snapshot }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 5000)
}
onBeforeUnmount(() => clearTimeout(toastTimer))
function undo() {
  if (toast.value) store.restoreNotes(toast.value.snapshot)
  toast.value = null
}
function place(themeId: string | null, units: WorkUnit[]) {
  if (!units.length) return
  const before = store.notes
  store.moveWork(themeId, units)
  flash(themeId ? `Moved ${items(units.length)} to ${themeName(themeId)}` : `Unassigned ${items(units.length)}`, before)
}
function placeNew(units: WorkUnit[]) {
  pending = units
  nameDialog.value = true
}
function newTheme(name: string) {
  const before = store.notes
  const id = store.createTheme(name)
  if (pending?.length) {
    store.moveWork(id, pending)
    flash(`Moved ${items(pending.length)} to ${name}`, before)
  } else flash(`Created ${name}`, before)
  pending = null
}
function openNewTheme() {
  pending = null
  nameDialog.value = true
}
// number keys follow theme order; badges show while the inbox has focus or something is being dragged
const inboxFocus = ref(false)
const numberOf = (id: string) => {
  const n = store.notes.themes.findIndex((t) => t.id === id) + 1
  return n >= 1 && n <= 9 && (inboxFocus.value || drag.value) ? n : undefined
}
const showInbox = computed(() => themed.value.unassigned.length > 0 || !!drag.value)
// wide panel (48rem, same as the inbox's @3xl variants): inbox and themes side by side with a draggable divider
const body = useTemplateRef<HTMLElement>('body')
const { width: bodyWidth } = useElementSize(body)
const split = computed(() => showInbox.value && bodyWidth.value >= 768)
const [DefineInbox, Inbox] = createReusableTemplate()
const [DefineThemes, Themes] = createReusableTemplate()
const showEmpty = ref(false)
const nf = (n: number) => n.toLocaleString()
</script>

<template>
  <Card class="gap-0 overflow-visible py-0" data-testid="summary">
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
    <div v-else class="@container">
      <div ref="body" class="space-y-4 p-4">
        <p v-if="!summary.totals.commits" class="text-sm text-muted-foreground">No commits in this range.</p>
        <p v-else-if="summary.totals.noiseHidden" class="text-sm text-muted-foreground">
          {{ nf(summary.totals.noiseHidden) }} noise {{ summary.totals.noiseHidden === 1 ? 'commit' : 'commits' }} hidden from the lists below
        </p>
        <DefineInbox>
          <UnassignedInbox
            :groups="themed.unassigned"
            :color="color"
            :repo-name="repoName"
            @place="place"
            @place-new="placeNew"
            @focus="(on) => (inboxFocus = on)"
          />
        </DefineInbox>
        <DefineThemes>
          <div class="min-w-0 space-y-4">
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
              :number="numberOf(c.theme.id)"
              @up="store.reorderTheme(c.theme.id, cardIds[i - 1]!)"
              @down="store.reorderTheme(c.theme.id, cardIds[i + 1]!)"
              @drop="(us) => place(c.theme.id, us)"
              @unassign="(us) => place(null, us)"
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
                :number="numberOf(t.id)"
                @up="store.reorderTheme(t.id, themed.empty[i - 1]!.id)"
                @down="store.reorderTheme(t.id, themed.empty[i + 1]!.id)"
                @drop="(us) => place(t.id, us)"
              />
            </div>
            <!-- while dragging, collapsed themes become compact drop chips -->
            <div v-else-if="themed.empty.length && drag" class="space-y-2">
              <ThemeDropZone v-for="t in themed.empty" :key="t.id" :label="t.name || 'Untitled theme'" :number="numberOf(t.id)" @drop="(us) => place(t.id, us)" />
            </div>
            <Collapsible v-else-if="themed.empty.length" v-model:open="showEmpty" class="space-y-3">
              <CollapsibleTrigger as-child>
                <Button variant="link" class="h-auto px-0 text-muted-foreground" :aria-expanded="showEmpty">
                  <component :is="showEmpty ? ChevronDown : ChevronRight" />
                  {{ themed.empty.length }} {{ themed.empty.length === 1 ? 'theme' : 'themes' }} with no work in this range
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent class="space-y-3">
                <ThemeCard v-for="t in themed.empty" :key="t.id" :theme="t" :color="color" :repo-name="repoName" :can-up="false" :can-down="false" @drop="(us) => place(t.id, us)" />
              </CollapsibleContent>
            </Collapsible>

            <ThemeDropZone v-if="drag" label="+ New theme" dashed @drop="placeNew" />
          </div>
        </DefineThemes>

        <!-- wide: resizable split (inbox width remembered); narrow: inbox on top -->
        <ResizablePanelGroup v-if="split" direction="horizontal" auto-save-id="shiplog-story-split">
          <!-- panels stretch to the row so the inbox can stick; overflow-visible! beats the panels' inline
               overflow:hidden, which would break sticky and clip the drop rings -->
          <ResizablePanel :default-size="40" :min-size="22" :max-size="65" class="overflow-visible! pr-3">
            <Inbox />
          </ResizablePanel>
          <ResizableHandle with-handle />
          <ResizablePanel :default-size="60" :min-size="35" class="overflow-visible! pl-3">
            <Themes />
          </ResizablePanel>
        </ResizablePanelGroup>
        <div v-else class="flex flex-col gap-4">
          <Inbox v-if="showInbox" />
          <Themes />
        </div>
      </div>
      <div class="pointer-events-none sticky bottom-4 flex justify-center px-4 pb-2" role="status" aria-live="polite">
        <div v-if="toast" class="pointer-events-auto flex items-center gap-3 rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md" data-testid="undo-toast">
          <span>{{ toast.text }}</span>
          <Button size="sm" variant="outline" @click="undo">Undo</Button>
        </div>
      </div>
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
