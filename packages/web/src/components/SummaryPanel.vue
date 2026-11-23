<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CommitType } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { commitKey } from '@shiplog/shared'
import { rangeLabel, ymd } from '../lib/dates'
import { themeGanttRows } from '../lib/charts'
import { themeGanttMermaid } from '../lib/mermaid'
import { download, renderMermaid, standaloneSvg, svgToPng, type Rendered } from '../lib/mermaidImage'
import { loadPref, savePref } from '../lib/prefs'
import { summarize, toMarkdown, TYPE_LABELS } from '../lib/summary'
import { groupByTheme } from '../lib/themes'
import { prefersDark } from '../lib/theme'
import TypeBadge from './TypeBadge.vue'
import TicketRow from './TicketRow.vue'
import ThemeCard from './ThemeCard.vue'
import AddToTheme from './AddToTheme.vue'
import ThemeNameDialog from './ThemeNameDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ChevronDown, ChevronRight, Plus, Star } from '@lucide/vue'

const GROUPS = ['theme', 'ticket', 'type', 'repo'] as const
type GroupBy = (typeof GROUPS)[number]
const GROUP_LABELS: Record<GroupBy, string> = { theme: 'Theme', ticket: 'Ticket', type: 'Type', repo: 'Repo' }

const store = useAppStore()
const groupBy = ref<GroupBy>(loadPref('oo.summary.groupBy', GROUPS, 'theme'))
const hideNoise = ref(loadPref('oo.summary.hideNoise', ['1', '0'] as const, '1') === '1')
watch(groupBy, (v) => savePref('oo.summary.groupBy', v))
// a click in the themes timeline needs the theme view so the card exists
watch(() => store.themeFocus, (f) => f && (groupBy.value = 'theme'), { immediate: true })
watch(hideNoise, (v) => savePref('oo.summary.hideNoise', v ? '1' : '0'))
const withTimeline = ref(loadPref('oo.summary.mermaid', ['1', '0'] as const, '1') === '1')
watch(withTimeline, (v) => savePref('oo.summary.mermaid', v ? '1' : '0'))

const summary = computed(() => summarize(store.commitsInRange, { hideNoise: hideNoise.value }))
const repoNames = computed(() => Object.fromEntries(store.repos.map((r) => [r.id, r.name])))
const repoName = (id: string) => repoNames.value[id] ?? id
const themed = computed(() => groupByTheme(summary.value.items, store.notes))
const mermaid = computed(() =>
  groupBy.value === 'theme'
    ? themeGanttMermaid(themeGanttRows(store.commitsInRange, store.notes.themes, store.notes.highlights, store.range), store.range, { title: rangeLabel(store.range) })
    : null,
)
const markdown = computed(() =>
  toMarkdown(summary.value, {
    rangeLabel: rangeLabel(store.range),
    groupBy: groupBy.value === 'theme' || groupBy.value === 'ticket' ? groupBy.value : 'type',
    repoNames: repoNames.value,
    themes: themed.value,
    mermaid: withTimeline.value ? mermaid.value : null,
  }),
)
const starred = (it: { commit: { repoId: string; hash: string } }) => store.isHighlighted(commitKey(it.commit))
const repoStars = (repoId: string) => store.notes.highlights.filter((k) => k.startsWith(repoId + ':')).length
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
const color = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}
const showPreview = ref(false)
// pele render of the timeline; an error is shown as a muted line instead
const diagram = computed<{ ok: Rendered } | { err: string } | null>(() => {
  if (!mermaid.value) return null
  try {
    return { ok: renderMermaid(mermaid.value) }
  } catch (e) {
    return { err: e instanceof Error ? e.message : String(e) }
  }
})
const imageName = (ext: string) => `shiplog-themes-${ymd(store.range.from)}-${ymd(store.range.to)}.${ext}`
const imageNote = ref('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  imageNote.value = msg
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => (imageNote.value = ''), 2500)
}
function downloadSvg() {
  const d = diagram.value
  if (d && 'ok' in d) download(new Blob([standaloneSvg(d.ok)], { type: 'image/svg+xml' }), imageName('svg'))
}
async function copyImage() {
  const d = diagram.value
  if (!d || !('ok' in d)) return
  try {
    const png = await svgToPng(standaloneSvg(d.ok), d.ok.width, d.ok.height, 2)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      flash('Image copied ✓')
    } catch {
      download(png, imageName('png')) // clipboard image write unsupported
      flash('Downloaded PNG')
    }
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Could not export image')
  }
}
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
      <div v-if="groupBy === 'theme'" class="ml-auto flex items-center gap-2 text-sm">
        <Checkbox id="with-timeline" v-model="withTimeline" />
        <Label for="with-timeline" class="cursor-pointer font-normal">Include timeline</Label>
      </div>
      <Button :class="groupBy === 'theme' ? '' : 'ml-auto'" size="sm" :disabled="!summary.totals.commits" @click="copy">
        {{ copied ? 'Copied ✓' : 'Copy as Markdown' }}
      </Button>
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
    <p v-else-if="!summary.totals.commits && groupBy !== 'theme'" class="p-4 text-sm text-muted-foreground">No commits in this range. Try a wider range or Rescan.</p>
    <div v-else class="space-y-5 p-4">
      <!-- range totals live in the timeline header; only the filter's effect is reported here -->
      <p v-if="!summary.totals.commits" class="text-sm text-muted-foreground">No commits in this range.</p>
      <p v-else-if="summary.totals.noiseHidden" class="text-sm text-muted-foreground">
        {{ nf(summary.totals.noiseHidden) }} noise {{ summary.totals.noiseHidden === 1 ? 'commit' : 'commits' }} hidden from the lists below
      </p>

      <!-- Theme view -->
      <div v-if="groupBy === 'theme'" class="space-y-4">
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

        <Button variant="outline" size="sm" @click="openNewTheme"><Plus /> New theme</Button>
      </div>

      <!-- Ticket view -->
      <ul v-else-if="groupBy === 'ticket'" class="divide-y rounded-md border">
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

      <!-- Markdown preview -->
      <Collapsible v-if="summary.totals.commits" v-model:open="showPreview">
        <CollapsibleTrigger as-child>
          <Button variant="link" class="h-auto px-0" :aria-expanded="showPreview">
            <component :is="showPreview ? ChevronDown : ChevronRight" /> Preview markdown
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div v-if="diagram" class="mt-2 space-y-2">
            <p v-if="'err' in diagram" class="text-xs text-muted-foreground">Timeline preview unavailable: {{ diagram.err }}</p>
            <template v-else>
              <!-- pele reads --pele-* from here; mapped to the app tokens so light/dark follow the page -->
              <div class="pele-theme overflow-x-auto rounded-md border bg-background p-2" v-html="diagram.ok.svg" />
              <div class="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" @click="copyImage">Copy image</Button>
                <Button size="sm" variant="outline" @click="downloadSvg">Download SVG</Button>
                <span v-if="imageNote" class="text-xs text-muted-foreground" role="status">{{ imageNote }}</span>
              </div>
            </template>
          </div>
          <pre class="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{{ markdown }}</pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
    <ThemeNameDialog v-model:open="nameDialog" @submit="newTheme" />
  </Card>
</template>
