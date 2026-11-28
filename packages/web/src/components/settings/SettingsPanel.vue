<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { AppConfig, AuthorInfo, ScanResult } from '@shiplog/shared'
import * as api from '../../api'
import FolderPicker from '../FolderPicker.vue'
import SettingsSection from '../SettingsSection.vue'
import { useAppStore } from '../../stores/app'
import { type SettingsSection as SectionId, settingsDirty } from '../../lib/ui'
import { baseline, draft, excludeText, ignoreText, kwText, loadDraft, SINCE_PRESETS, sinceMode } from './draft'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Check, ChevronDown, FolderOpen, Loader2, Search, X } from '@lucide/vue'

const props = defineProps<{ section: SectionId | null }>()
const store = useAppStore()

const rm = 'ml-auto h-auto shrink-0 px-1 py-0 text-muted-foreground hover:text-destructive'
const advancedOpen = ref(false)
const body = ref<HTMLElement | null>(null)

const authors = ref<AuthorInfo[]>([])
const authorsLoading = ref(false)

const newRoot = ref('')
const newPinned = ref('')
const newEmail = ref('')
const repoQuery = ref('')
const picker = ref<{ key: 'scanRoots' | 'pinnedRepos'; initial: string } | null>(null)
function onPicked(p: string) {
  if (picker.value) addTo(picker.value.key, p)
  picker.value = null
}

const saving = ref(false)
const errorMsg = ref('')
const errorDetails = ref<string[]>([])
const result = ref<ScanResult | null>(null)
const savedMsg = ref('')

const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)

const kwParsed = computed<{ value?: AppConfig['classifier']['keywords']; error?: string }>(() => {
  try {
    const v = JSON.parse(kwText.value || '{}')
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'Must be a JSON object, e.g. {"fix": ["hotfix"]}' }
    return { value: v }
  } catch (e) {
    return { error: (e as Error).message }
  }
})

const candidate = computed<AppConfig | null>(() => {
  if (!draft.value) return null
  return {
    ...draft.value,
    ignoreDirs: lines(ignoreText.value),
    excludeFromStats: lines(excludeText.value),
    classifier: { keywords: kwParsed.value.value ?? draft.value.classifier.keywords },
  }
})
const dirty = computed(() => !!candidate.value && JSON.stringify(candidate.value) !== baseline.value)
const canSave = computed(() => dirty.value && !kwParsed.value.error && !saving.value)
watch(dirty, (v) => (settingsDirty.value = v), { immediate: true })

async function loadAuthors() {
  authorsLoading.value = true
  try {
    authors.value = await api.getAuthors()
  } catch {
    authors.value = []
  } finally {
    authorsLoading.value = false
  }
}

function jump(id: SectionId | null, focus = false) {
  if (!id) return
  if (id === 'advanced') advancedOpen.value = true
  nextTick(() => {
    const el = document.getElementById(`settings-${id}`)
    el?.scrollIntoView({ block: 'start' })
    if (focus) el?.querySelector<HTMLInputElement>('input:not([type=checkbox]), textarea')?.focus({ preventScroll: true })
  })
}

onMounted(async () => {
  store.loadRepos()
  if (!store.config) await store.loadConfig()
  // keep an unsaved draft from a previous open; otherwise start from the saved config
  if (store.config && (!draft.value || !dirty.value)) loadDraft(store.config)
  loadAuthors()
  jump(props.section, props.section === 'folders' || props.section === 'emails')
})
watch(() => props.section, (s) => jump(s))

// ---- list helpers ----
function addTo(key: 'scanRoots' | 'pinnedRepos', raw: string) {
  const v = raw.trim()
  if (!v || !draft.value) return
  if (!draft.value[key].includes(v)) draft.value[key] = [...draft.value[key], v]
}
function removeFrom(key: 'scanRoots' | 'pinnedRepos' | 'authorEmails', v: string) {
  if (draft.value) draft.value[key] = draft.value[key].filter((x) => x !== v)
}

// emails
const hasEmail = (e: string) => !!draft.value?.authorEmails.some((x) => x.toLowerCase() === e.toLowerCase())
function toggleEmail(e: string) {
  if (!draft.value) return
  if (hasEmail(e)) draft.value.authorEmails = draft.value.authorEmails.filter((x) => x.toLowerCase() !== e.toLowerCase())
  else draft.value.authorEmails = [...draft.value.authorEmails, e]
}
function addEmail() {
  const v = newEmail.value.trim()
  if (v && !hasEmail(v)) draft.value!.authorEmails = [...draft.value!.authorEmails, v]
  newEmail.value = ''
}

// repos
const isIncluded = (path: string) => !draft.value?.excludedRepos.includes(path)
function toggleRepo(path: string) {
  if (!draft.value) return
  draft.value.excludedRepos = isIncluded(path)
    ? [...draft.value.excludedRepos, path]
    : draft.value.excludedRepos.filter((p) => p !== path)
}
const isPinned = (path: string) => !!draft.value?.pinnedRepos.includes(path)
const includedCount = computed(() => store.sortedRepos.filter((r) => isIncluded(r.path)).length)
const filteredRepos = computed(() => {
  const q = repoQuery.value.trim().toLowerCase()
  return q ? store.sortedRepos.filter((r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)) : store.sortedRepos
})

// since
watch(sinceMode, (m) => {
  if (draft.value && m !== 'custom') draft.value.since = m
})

async function save() {
  if (!candidate.value) return
  saving.value = true
  errorMsg.value = ''
  errorDetails.value = []
  savedMsg.value = ''
  result.value = null
  try {
    const r = await store.saveConfigAndRescan(candidate.value)
    result.value = r
    if (store.config) loadDraft(store.config)
    savedMsg.value = `Saved · ${store.repos.length} repos · ${store.allCommits.length} commits`
    loadAuthors()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
    errorDetails.value = e instanceof api.ApiError ? e.details : []
  } finally {
    saving.value = false
  }
}
function discard() {
  if (store.config) loadDraft(store.config)
  errorMsg.value = ''
  errorDetails.value = []
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <header class="border-b px-5 pt-4 pb-3 pr-12">
      <SheetTitle class="text-base">Settings</SheetTitle>
      <SheetDescription class="mt-0.5 text-xs">
        Where the timeline's commits come from. Saving writes <span class="font-mono">config.json</span> and rescans your repos (a few seconds).
        Hiding repos from view is in the sidebar and is instant.
      </SheetDescription>
    </header>

    <div v-if="!draft" class="flex-1 p-5 text-sm text-muted-foreground">
      {{ store.error ?? 'Loading settings…' }}
    </div>
    <div v-else ref="body" class="min-h-0 flex-1 divide-y overflow-y-auto">
      <SettingsSection id="settings-folders" title="Scan folders" hint="Directories searched recursively for git repos. Absolute or ~ paths.">
        <ul v-if="draft.scanRoots.length" class="divide-y rounded-md border">
          <li v-for="p in draft.scanRoots" :key="p" class="flex items-center gap-2 px-3 py-1.5 font-mono text-xs">
            <FolderOpen class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span class="truncate" :title="p">{{ p }}</span>
            <Button variant="ghost" size="xs" :class="rm" :aria-label="`Remove ${p}`" @click="removeFrom('scanRoots', p)">Remove</Button>
          </li>
        </ul>
        <p v-else class="text-xs text-amber-700 dark:text-amber-400">No folders yet. Add the folder that holds your repos, e.g. ~/code.</p>
        <form class="flex gap-2" @submit.prevent="addTo('scanRoots', newRoot); newRoot = ''">
          <Input v-model="newRoot" class="h-8 flex-1 font-mono text-xs" placeholder="~/code" aria-label="Scan folder path" />
          <Button type="button" variant="outline" size="sm" class="h-8" @click="picker = { key: 'scanRoots', initial: newRoot }">Browse…</Button>
          <Button type="submit" variant="outline" size="sm" class="h-8" :disabled="!newRoot.trim()">Add</Button>
        </form>
      </SettingsSection>

      <SettingsSection id="settings-emails" title="Your emails" hint="Only commits authored with these emails are shown (case-insensitive). Pick them from the authors found in your repos.">
        <ul class="flex flex-wrap gap-1.5">
          <li v-for="e in draft.authorEmails" :key="e">
            <Badge variant="secondary" class="h-6 gap-1.5 pr-1.5 pl-2.5 text-xs">
              {{ e }}
              <button class="rounded-sm hover:text-destructive" :aria-label="`Remove ${e}`" @click="removeFrom('authorEmails', e)"><X class="size-3" /></button>
            </Badge>
          </li>
          <li v-if="!draft.authorEmails.length" class="text-xs text-amber-700 dark:text-amber-400">
            No emails set: no commits will match.
          </li>
        </ul>
        <div>
          <h4 class="mb-1 text-xs font-medium text-muted-foreground">Detected authors</h4>
          <p v-if="authorsLoading" class="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 class="size-3 animate-spin" />Reading git history…</p>
          <p v-else-if="!authors.length" class="text-xs text-muted-foreground">No authors found yet. Add a scan folder and save first.</p>
          <ul v-else class="max-h-56 divide-y overflow-auto rounded-md border">
            <li
              v-for="a in authors" :key="a.email"
              class="flex items-center gap-3 px-3 py-1.5 text-xs"
              :class="hasEmail(a.email) ? 'bg-accent' : ''"
            >
              <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <Checkbox :model-value="hasEmail(a.email)" @update:model-value="toggleEmail(a.email)" />
                <span class="truncate font-medium">{{ a.email }}</span>
                <span class="truncate text-muted-foreground">{{ (a.names?.length ? a.names : [a.name]).join(', ') }}</span>
              </label>
              <span class="shrink-0 text-muted-foreground tabular-nums">{{ a.commits }} commits</span>
            </li>
          </ul>
        </div>
        <form class="flex gap-2" @submit.prevent="addEmail">
          <Input v-model="newEmail" type="text" class="h-8 flex-1 text-xs" placeholder="Or type an email: you@example.com" aria-label="Add email" />
          <Button type="submit" variant="outline" size="sm" class="h-8" :disabled="!newEmail.trim()">Add</Button>
        </form>
      </SettingsSection>

      <SettingsSection id="settings-repos" title="Repos" :hint="`${includedCount} of ${store.sortedRepos.length} included. Excluded repos are not read at all.`">
        <div v-if="store.sortedRepos.length > 8" class="relative">
          <Search class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input v-model="repoQuery" class="h-8 pl-7 text-xs" placeholder="Filter repos" aria-label="Filter repos in settings" />
        </div>
        <ul class="max-h-72 divide-y overflow-auto rounded-md border">
          <li v-for="r in filteredRepos" :key="r.id" class="flex items-center gap-3 px-3 py-1.5 text-xs">
            <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <Checkbox :model-value="isIncluded(r.path)" @update:model-value="toggleRepo(r.path)" />
              <span class="shrink-0 font-medium" :class="isIncluded(r.path) ? '' : 'text-muted-foreground line-through'">{{ r.name }}</span>
              <span class="truncate font-mono text-[11px] text-muted-foreground" :title="r.path">{{ r.path }}</span>
            </label>
            <Badge v-if="isPinned(r.path)" variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">pinned</Badge>
          </li>
          <li v-if="!store.sortedRepos.length" class="px-3 py-2 text-xs text-muted-foreground">No repos found yet.</li>
          <li v-else-if="!filteredRepos.length" class="px-3 py-2 text-xs text-muted-foreground">No repos match.</li>
        </ul>
        <div class="pt-1">
          <h4 class="text-xs font-medium">Pinned repos</h4>
          <p class="mb-2 text-xs text-muted-foreground">Extra repo paths always included, even outside scan folders.</p>
          <ul v-if="draft.pinnedRepos.length" class="mb-2 divide-y rounded-md border">
            <li v-for="p in draft.pinnedRepos" :key="p" class="flex items-center gap-3 px-3 py-1.5 font-mono text-xs">
              <span class="truncate" :title="p">{{ p }}</span>
              <Button variant="ghost" size="xs" :class="rm" :aria-label="`Unpin ${p}`" @click="removeFrom('pinnedRepos', p)">Remove</Button>
            </li>
          </ul>
          <form class="flex gap-2" @submit.prevent="addTo('pinnedRepos', newPinned); newPinned = ''">
            <Input v-model="newPinned" class="h-8 flex-1 font-mono text-xs" placeholder="/path/to/repo" aria-label="Pin repo path" />
            <Button type="button" variant="outline" size="sm" class="h-8" @click="picker = { key: 'pinnedRepos', initial: newPinned }">Browse…</Button>
            <Button type="submit" variant="outline" size="sm" class="h-8" :disabled="!newPinned.trim()">Pin</Button>
          </form>
        </div>
      </SettingsSection>

      <SettingsSection id="settings-history" title="History window" hint="How far back to read git history. The timeline can't show anything older.">
        <div class="flex flex-wrap items-center gap-2">
          <Select v-model="sinceMode">
            <SelectTrigger class="w-44" aria-label="History window"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in SINCE_PRESETS" :key="p.value" :value="p.value">Last {{ p.label }}</SelectItem>
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-if="sinceMode === 'custom'" v-model="draft.since" class="h-8 w-64 font-mono text-xs"
            placeholder="18 months ago, 2025-01-01" aria-label="Custom git --since"
          />
        </div>
      </SettingsSection>

      <Collapsible id="settings-advanced" v-model:open="advancedOpen" as="section" class="scroll-mt-2">
        <CollapsibleTrigger class="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left text-sm font-semibold hover:bg-muted/40">
          <span>Advanced <span class="ml-1 text-xs font-normal text-muted-foreground">scan depth, ignored dirs, stats globs, classifier</span></span>
          <ChevronDown class="size-4 transition-transform" :class="advancedOpen && 'rotate-180'" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="space-y-4 px-5 pb-5 text-sm">
            <div class="space-y-1">
              <Label for="scan-depth" class="text-xs">Scan depth (1–10)</Label>
              <Input id="scan-depth" v-model.number="draft.scanDepth" type="number" min="1" max="10" class="h-8 w-24" />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-1">
                <Label for="ignore-dirs" class="text-xs">Ignored directory names (one per line)</Label>
                <Textarea id="ignore-dirs" v-model="ignoreText" rows="6" class="font-mono text-xs" />
              </div>
              <div class="space-y-1">
                <Label for="exclude-globs" class="text-xs">Exclude from line stats (globs, one per line)</Label>
                <Textarea id="exclude-globs" v-model="excludeText" rows="6" class="font-mono text-xs" />
              </div>
            </div>
            <div class="space-y-1">
              <Label for="kw-json" class="text-xs">Classifier keywords (JSON: type → regex list)</Label>
              <Textarea id="kw-json" v-model="kwText" rows="5" spellcheck="false" class="font-mono text-xs" :aria-invalid="!!kwParsed.error" />
              <span v-if="kwParsed.error" class="text-xs text-destructive">Invalid JSON: {{ kwParsed.error }}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div v-if="errorMsg || result?.errors.length" class="space-y-3 px-5 py-4">
        <Alert v-if="errorMsg" variant="destructive">
          <AlertTitle>{{ errorMsg }}</AlertTitle>
          <AlertDescription v-if="errorDetails.length">
            <ul class="list-disc pl-5">
              <li v-for="d in errorDetails" :key="d">{{ d }}</li>
            </ul>
          </AlertDescription>
        </Alert>
        <Alert v-if="result?.errors.length" class="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTitle>Scan errors</AlertTitle>
          <AlertDescription class="text-inherit">
            <ul class="list-disc pl-5">
              <li v-for="e in result.errors" :key="e.repoPath"><span class="font-mono">{{ e.repoPath }}</span>: {{ e.message }}</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>

    <footer class="flex items-center gap-3 border-t bg-popover px-5 py-3 text-xs" data-testid="settings-footer">
      <span v-if="saving" class="flex items-center gap-2 text-muted-foreground"><Loader2 class="size-3.5 animate-spin" />Saving and rescanning…</span>
      <span v-else-if="dirty" class="flex items-center gap-1.5 text-amber-700 dark:text-amber-400"><span class="size-2 rounded-full bg-amber-500" />Unsaved changes</span>
      <span v-else-if="savedMsg" class="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><Check class="size-3.5" />{{ savedMsg }}</span>
      <span v-else class="text-muted-foreground">No changes</span>
      <div class="ml-auto flex gap-2">
        <Button variant="ghost" size="sm" :disabled="!dirty || saving" @click="discard">Discard</Button>
        <Button size="sm" :disabled="!canSave" data-testid="settings-save" @click="save">
          <Loader2 v-if="saving" class="animate-spin" />Save &amp; rescan
        </Button>
      </div>
    </footer>

    <FolderPicker
      v-if="picker"
      :title="picker.key === 'scanRoots' ? 'Choose a scan folder' : 'Choose a repo to pin'"
      :initial-path="picker.initial"
      @select="onPicked" @close="picker = null"
    />
  </div>
</template>
