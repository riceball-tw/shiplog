<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { AppConfig, AuthorInfo, ScanResult } from '@one-on-one/shared'
import * as api from '../api'
import FolderPicker from '../components/FolderPicker.vue'
import SettingsSection from '../components/SettingsSection.vue'
import { useAppStore } from '../stores/app'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, X } from '@lucide/vue'

const store = useAppStore()

const rm = 'ml-auto h-auto px-1 py-0 text-destructive'
const advancedOpen = ref(false)

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const draft = ref<AppConfig | null>(null)
const baseline = ref('')
const ignoreText = ref('')
const excludeText = ref('')
const kwText = ref('{}')
const sinceMode = ref<string>('12 months ago')
const authors = ref<AuthorInfo[]>([])
const authorsLoading = ref(false)

const newRoot = ref('')
const newPinned = ref('')
const newEmail = ref('')
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

const SINCE_PRESETS = [3, 6, 12, 24].map((n) => ({ value: `${n} months ago`, label: `${n} months` }))

function load(cfg: AppConfig) {
  draft.value = clone(cfg)
  ignoreText.value = cfg.ignoreDirs.join('\n')
  excludeText.value = cfg.excludeFromStats.join('\n')
  kwText.value = JSON.stringify(cfg.classifier.keywords, null, 2)
  sinceMode.value = SINCE_PRESETS.some((p) => p.value === cfg.since) ? cfg.since : 'custom'
  baseline.value = JSON.stringify(cfg)
}

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

onMounted(async () => {
  store.loadRepos()
  if (!store.config) await store.loadConfig()
  if (store.config) load(store.config)
  loadAuthors()
})

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
    if (store.config) load(store.config)
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
  if (store.config) load(store.config)
  errorMsg.value = ''
  errorDetails.value = []
}
</script>

<template>
  <div v-if="!draft" class="text-sm text-muted-foreground">
    {{ store.error ?? 'Loading settings…' }}
  </div>
  <div v-else class="space-y-4 pb-24">
    <h2 class="text-xl font-semibold">Settings</h2>

    <SettingsSection title="Scan folders" hint="Directories searched recursively for git repos. Absolute or ~ paths.">
      <ul class="space-y-1">
        <li v-for="p in draft.scanRoots" :key="p" class="flex items-center gap-3 font-mono text-sm">
          <span class="truncate">{{ p }}</span>
          <Button variant="ghost" size="xs" :class="rm" @click="removeFrom('scanRoots', p)">Remove</Button>
        </li>
        <li v-if="!draft.scanRoots.length" class="text-sm text-muted-foreground">No folders yet.</li>
      </ul>
      <form class="flex gap-2" @submit.prevent="addTo('scanRoots', newRoot); newRoot = ''">
        <Input v-model="newRoot" class="flex-1 font-mono" placeholder="~/code" aria-label="Scan folder path" />
        <Button type="button" variant="outline" @click="picker = { key: 'scanRoots', initial: newRoot }">Browse…</Button>
        <Button type="submit" variant="outline">Add</Button>
      </form>
    </SettingsSection>

    <SettingsSection title="Your emails" hint="Commits authored with these emails are treated as yours (case-insensitive).">
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="e in draft.authorEmails" :key="e"
          >
          <Badge variant="secondary" class="h-6 gap-1.5 px-2.5 text-sm">
            {{ e }}
            <button class="hover:text-destructive" :aria-label="`Remove ${e}`" @click="removeFrom('authorEmails', e)"><X class="size-3" /></button>
          </Badge>
        </li>
        <li v-if="!draft.authorEmails.length" class="text-sm text-amber-600 dark:text-amber-400">
          No emails set: no commits will match.
        </li>
      </ul>
      <form class="flex gap-2" @submit.prevent="addEmail">
        <Input v-model="newEmail" type="text" class="flex-1" placeholder="you@example.com" aria-label="Add email" />
        <Button type="submit" variant="outline">Add</Button>
      </form>
      <div>
        <h3 class="mb-1 text-sm font-medium">Detected authors</h3>
        <p v-if="authorsLoading" class="text-sm text-muted-foreground">Reading git history…</p>
        <p v-else-if="!authors.length" class="text-sm text-muted-foreground">No authors found (add a scan folder first).</p>
        <ul v-else class="max-h-64 divide-y overflow-auto rounded-md border">
          <li
            v-for="a in authors" :key="a.email"
            class="flex items-center gap-3 px-3 py-1.5 text-sm"
            :class="hasEmail(a.email) ? 'bg-accent' : ''"
          >
            <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <Checkbox :model-value="hasEmail(a.email)" @update:model-value="toggleEmail(a.email)" />
              <span class="truncate font-medium">{{ a.email }}</span>
              <span class="truncate text-muted-foreground">{{ (a.names?.length ? a.names : [a.name]).join(', ') }}</span>
            </label>
            <span class="tabular-nums text-muted-foreground">{{ a.commits }} commits</span>
          </li>
        </ul>
      </div>
    </SettingsSection>

    <SettingsSection title="Repos" :hint="`${includedCount} of ${store.sortedRepos.length} included. Excluded repos are hidden from the timeline.`">
      <ul class="divide-y rounded-md border">
        <li v-for="r in store.sortedRepos" :key="r.id" class="flex items-center gap-3 px-3 py-1.5 text-sm">
          <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <Checkbox :model-value="isIncluded(r.path)" @update:model-value="toggleRepo(r.path)" />
            <span class="font-medium" :class="isIncluded(r.path) ? '' : 'text-muted-foreground line-through'">{{ r.name }}</span>
            <span class="truncate font-mono text-xs text-muted-foreground">{{ r.path }}</span>
          </label>
          <Badge v-if="isPinned(r.path)" variant="secondary" class="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">pinned</Badge>
        </li>
        <li v-if="!store.sortedRepos.length" class="px-3 py-2 text-sm text-muted-foreground">No repos found.</li>
      </ul>
      <div>
        <h3 class="mb-1 text-sm font-medium">Pinned repos</h3>
        <p class="mb-1 text-xs text-muted-foreground">Extra repo paths always included, even outside scan folders.</p>
        <ul class="space-y-1">
          <li v-for="p in draft.pinnedRepos" :key="p" class="flex items-center gap-3 font-mono text-sm">
            <span class="truncate">{{ p }}</span>
            <Button variant="ghost" size="xs" :class="rm" @click="removeFrom('pinnedRepos', p)">Remove</Button>
          </li>
        </ul>
        <form class="mt-2 flex gap-2" @submit.prevent="addTo('pinnedRepos', newPinned); newPinned = ''">
          <Input v-model="newPinned" class="flex-1 font-mono" placeholder="/path/to/repo" aria-label="Pin repo path" />
          <Button type="button" variant="outline" @click="picker = { key: 'pinnedRepos', initial: newPinned }">Browse…</Button>
          <Button type="submit" variant="outline">Pin</Button>
        </form>
      </div>
    </SettingsSection>

    <SettingsSection title="History window" hint="How far back to read git history.">
      <div class="flex flex-wrap items-center gap-2">
        <Select v-model="sinceMode">
          <SelectTrigger class="w-44" aria-label="History window"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in SINCE_PRESETS" :key="p.value" :value="p.value">Last {{ p.label }}</SelectItem>
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
        <Input
          v-if="sinceMode === 'custom'" v-model="draft.since" class="w-64 font-mono"
          placeholder="18 months ago, 2025-01-01" aria-label="Custom git --since"
        />
      </div>
    </SettingsSection>

    <Collapsible v-model:open="advancedOpen" as-child>
      <Card class="gap-0 py-0">
        <CollapsibleTrigger class="flex w-full cursor-pointer items-center justify-between p-4 text-left text-base font-semibold">
          Advanced
          <ChevronDown class="size-4 transition-transform" :class="advancedOpen && 'rotate-180'" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="space-y-4 px-4 pb-4 text-sm">
            <div class="space-y-1">
              <Label for="scan-depth">Scan depth (1–10)</Label>
              <Input id="scan-depth" v-model.number="draft.scanDepth" type="number" min="1" max="10" class="w-24" />
            </div>
            <div class="space-y-1">
              <Label for="ignore-dirs">Ignored directory names (one per line)</Label>
              <Textarea id="ignore-dirs" v-model="ignoreText" rows="5" class="font-mono" />
            </div>
            <div class="space-y-1">
              <Label for="exclude-globs">Exclude from line stats (globs, one per line)</Label>
              <Textarea id="exclude-globs" v-model="excludeText" rows="6" class="font-mono" />
            </div>
            <div class="space-y-1">
              <Label for="kw-json">Classifier keywords (JSON: type → regex list)</Label>
              <Textarea id="kw-json" v-model="kwText" rows="6" spellcheck="false" class="font-mono" :aria-invalid="!!kwParsed.error" />
              <span v-if="kwParsed.error" class="text-destructive">Invalid JSON: {{ kwParsed.error }}</span>
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>

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

    <FolderPicker
      v-if="picker"
      :title="picker.key === 'scanRoots' ? 'Choose a scan folder' : 'Choose a repo to pin'"
      :initial-path="picker.initial"
      @select="onPicked" @close="picker = null"
    />

    <div class="fixed inset-x-0 bottom-0 border-t bg-card/95 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 text-sm">
        <span v-if="saving" class="text-muted-foreground">Saving and rescanning…</span>
        <span v-else-if="dirty" class="text-amber-600 dark:text-amber-400">● Unsaved changes</span>
        <span v-else-if="savedMsg" class="text-emerald-600 dark:text-emerald-400">{{ savedMsg }}</span>
        <span v-else class="text-muted-foreground">No changes</span>
        <div class="ml-auto flex gap-2">
          <Button variant="outline" :disabled="!dirty || saving" @click="discard">Discard</Button>
          <Button :disabled="!canSave" @click="save">Save</Button>
        </div>
      </div>
    </div>
  </div>
</template>
