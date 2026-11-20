<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import { prefersDark } from '../lib/theme'
import { loadPref, savePref } from '../lib/prefs'
import { type SettingsSection, settingsDirty, useSettingsSheet } from '../lib/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Eye, Search, SlidersHorizontal, TriangleAlert } from '@lucide/vue'

const store = useAppStore()
const { openSettings } = useSettingsSheet()

const query = ref('')
const SORTS = ['name', 'activity'] as const
const sort = ref(loadPref('oo.sidebar.sort', SORTS, 'activity'))
watch(sort, (v) => savePref('oo.sidebar.sort', v))
const excludedOpen = ref(false)

/** commits per repo in the current range, counted before the visibility filter so hidden repos still show a number */
const counts = computed(() => {
  const { from, to } = store.range
  const m = new Map<string, number>()
  for (const c of store.timedCommits) if (c.ts >= from && c.ts <= to) m.set(c.repoId, (m.get(c.repoId) ?? 0) + 1)
  return m
})
const included = computed(() => store.sortedRepos.filter((r) => r.included))
const excluded = computed(() => store.sortedRepos.filter((r) => !r.included))
const hidden = computed(() => new Set(store.hiddenRepoIds))
const visibleCount = computed(() => included.value.filter((r) => !hidden.value.has(r.id)).length)

const rows = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? included.value.filter((r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)) : included.value
  if (sort.value === 'name') return list
  return [...list].sort((a, b) => (counts.value.get(b.id) ?? 0) - (counts.value.get(a.id) ?? 0))
})

const color = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}

function onRow(e: MouseEvent, id: string) {
  if (e.altKey) solo(id)
  else store.toggleRepo(id)
}
function solo(id: string) {
  store.setHiddenRepoIds(included.value.filter((r) => r.id !== id).map((r) => r.id))
}
const showAll = () => store.setHiddenRepoIds([])
const hideAll = () => store.setHiddenRepoIds(included.value.map((r) => r.id))

// ---- data source summary (read-only; editing happens in the settings sheet) ----
const cfg = computed(() => store.config)
const home = (p: string) => p.replace(/^\/(Users|home)\/[^/]+/, '~')
const sinceLabel = computed(() => {
  const s = cfg.value?.since ?? ''
  const m = /^(\d+)\s*(day|week|month|year)s?\s+ago$/i.exec(s.trim())
  return m ? `Last ${m[1]} ${m[2]}${+m[1]! === 1 ? '' : 's'}` : `Since ${s}`
})
interface SourceRow {
  section: SettingsSection
  label: string
  value: string
  title?: string
  warn?: boolean
}
const sourceRows = computed<SourceRow[]>(() => {
  const c = cfg.value
  if (!c) return []
  const roots = c.scanRoots
  return [
    {
      section: 'folders',
      label: 'Folders',
      value: roots.length ? (roots.length === 1 ? home(roots[0]!) : `${home(roots[0]!)} +${roots.length - 1}`) : 'None yet',
      title: roots.join('\n'),
      warn: !roots.length && !c.pinnedRepos.length,
    },
    {
      section: 'emails',
      label: 'Emails',
      value: c.authorEmails.length ? (c.authorEmails.length === 1 ? c.authorEmails[0]! : `${c.authorEmails.length} emails`) : 'None — no commits match',
      title: c.authorEmails.join('\n'),
      warn: !c.authorEmails.length,
    },
    {
      section: 'repos',
      label: 'Repos',
      value: `${included.value.length} found${excluded.value.length ? ` · ${excluded.value.length} excluded` : ''}${c.pinnedRepos.length ? ` · ${c.pinnedRepos.length} pinned` : ''}`,
    },
    { section: 'history', label: 'History', value: sinceLabel.value, title: c.since },
  ]
})
</script>

<template>
  <div class="flex h-full flex-col text-sm">
    <!-- View: instant, client-side -->
    <section class="flex min-h-0 flex-1 flex-col" aria-labelledby="sb-view">
      <div class="space-y-2 px-3 pt-3 pb-2">
        <div class="flex items-center gap-2">
          <Eye class="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h2 id="sb-view" class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Show repos</h2>
          <span class="ml-auto text-xs text-muted-foreground tabular-nums" data-testid="visible-count">{{ visibleCount }}/{{ included.length }}</span>
        </div>
        <div v-if="included.length > 6" class="relative">
          <Search class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input v-model="query" class="h-7 bg-background pl-7 text-xs" placeholder="Filter repos" aria-label="Filter repos" />
        </div>
        <div v-if="included.length" class="flex items-center gap-1 text-xs">
          <Button variant="ghost" size="xs" :disabled="!store.hiddenRepoIds.length" @click="showAll">All</Button>
          <Button variant="ghost" size="xs" :disabled="visibleCount === 0" @click="hideAll">None</Button>
          <div class="ml-auto flex items-center rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Sort repos">
            <button
              v-for="s in SORTS" :key="s" role="radio" :aria-checked="sort === s"
              class="rounded-[5px] px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors"
              :class="sort === s && 'bg-background text-foreground shadow-xs'"
              @click="sort = s"
            >{{ s === 'name' ? 'A–Z' : 'Active' }}</button>
          </div>
        </div>
      </div>

      <ul class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" data-testid="repo-visibility">
        <li v-for="r in rows" :key="r.id" class="group/row relative">
          <button
            class="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            :aria-pressed="!hidden.has(r.id)"
            :title="`${r.path}\nClick to show/hide · Alt+click to show only this repo`"
            @click="onRow($event, r.id)"
          >
            <span
              class="size-3 shrink-0 rounded-[3px] border-2 transition-colors"
              :style="hidden.has(r.id) ? { borderColor: color(r.id) } : { borderColor: color(r.id), background: color(r.id) }"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1 truncate" :class="hidden.has(r.id) ? 'text-muted-foreground' : (counts.get(r.id) ? '' : 'text-foreground/60')">{{ r.name }}</span>
            <span class="text-xs text-muted-foreground tabular-nums group-hover/row:invisible" title="Commits in range">{{ counts.get(r.id) ?? 0 }}</span>
          </button>
          <button
            class="invisible absolute top-1/2 right-2 -translate-y-1/2 rounded px-1 text-[11px] text-muted-foreground group-hover/row:visible hover:text-foreground focus-visible:visible"
            :aria-label="`Show only ${r.name}`" @click="solo(r.id)"
          >only</button>
        </li>
        <li v-if="included.length && !rows.length" class="px-2 py-2 text-xs text-muted-foreground">No repos match “{{ query }}”.</li>
        <li v-if="!included.length" class="px-2 py-2 text-xs text-muted-foreground">
          No repos yet. Add a scan folder in the data source below.
        </li>
        <li v-if="excluded.length" class="mt-2">
          <Collapsible v-model:open="excludedOpen">
            <CollapsibleTrigger class="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent">
              <ChevronRight class="size-3.5 transition-transform" :class="excludedOpen && 'rotate-90'" />
              Excluded in settings ({{ excluded.length }})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul class="pb-1">
                <li v-for="r in excluded" :key="r.id" class="flex items-center gap-2 px-2 py-0.5 pl-7 text-xs text-muted-foreground" :title="r.path">
                  <span class="truncate line-through">{{ r.name }}</span>
                </li>
                <li class="pl-6">
                  <Button variant="link" size="xs" class="h-auto px-1 text-xs" @click="openSettings('repos')">Manage in settings</Button>
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>
        </li>
      </ul>
    </section>

    <!-- Data source: saved config, needs a rescan -->
    <section class="border-t bg-sidebar px-3 pt-2.5 pb-3" aria-labelledby="sb-source" data-testid="data-source">
      <div class="flex items-center gap-2">
        <SlidersHorizontal class="size-3.5 text-muted-foreground" aria-hidden="true" />
        <h2 id="sb-source" class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Data source</h2>
        <Button
          variant="ghost" size="xs" class="relative ml-auto -mr-1" data-testid="settings-toggle"
          :title="settingsDirty ? 'Unsaved settings' : 'Edit settings (⌘/Ctrl ,)'" @click="openSettings()"
        >
          Edit
          <span v-if="settingsDirty" class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500" aria-label="Unsaved settings" />
        </Button>
      </div>
      <p class="mt-0.5 mb-1.5 text-[11px] leading-snug text-muted-foreground">Saved to config.json. Changing it rescans your repos.</p>
      <div class="-mx-1.5 space-y-px">
        <button
          v-for="row in sourceRows" :key="row.section"
          class="flex w-full items-baseline gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-sidebar-accent"
          :title="row.title" @click="openSettings(row.section)"
        >
          <span class="w-14 shrink-0 text-muted-foreground">{{ row.label }}</span>
          <span class="flex min-w-0 flex-1 items-center gap-1 truncate" :class="row.warn && 'text-amber-700 dark:text-amber-400'">
            <TriangleAlert v-if="row.warn" class="size-3 shrink-0" aria-hidden="true" />
            <span class="truncate" :class="row.section === 'folders' && !row.warn && 'font-mono text-[11px]'">{{ row.value }}</span>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>
