<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { AppConfig, AuthorInfo, ScanResult } from '@one-on-one/shared'
import * as api from '../api'
import SettingsSection from '../components/SettingsSection.vue'
import { useAppStore } from '../stores/app'

const store = useAppStore()

const input =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950'
const btn =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-50'
const rm = 'text-sm text-red-600 hover:underline dark:text-red-400'

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
const newMeeting = ref('')

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
function addTo(key: 'scanRoots' | 'pinnedRepos' | 'meetings', raw: string) {
  const v = raw.trim()
  if (!v || !draft.value) return
  if (!draft.value[key].includes(v)) draft.value[key] = [...draft.value[key], v]
  if (key === 'meetings') draft.value.meetings.sort()
}
function removeFrom(key: 'scanRoots' | 'pinnedRepos' | 'meetings' | 'authorEmails', v: string) {
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
  <div v-if="!draft" class="text-sm text-slate-500">
    {{ store.error ?? 'Loading settings…' }}
  </div>
  <div v-else class="space-y-4 pb-24">
    <h2 class="text-xl font-semibold">Settings</h2>

    <SettingsSection title="Scan folders" hint="Directories searched recursively for git repos. Absolute or ~ paths.">
      <ul class="space-y-1">
        <li v-for="p in draft.scanRoots" :key="p" class="flex items-center gap-3 font-mono text-sm">
          <span class="truncate">{{ p }}</span>
          <button :class="[rm, 'ml-auto']" @click="removeFrom('scanRoots', p)">Remove</button>
        </li>
        <li v-if="!draft.scanRoots.length" class="text-sm text-slate-500">No folders yet.</li>
      </ul>
      <form class="flex gap-2" @submit.prevent="addTo('scanRoots', newRoot); newRoot = ''">
        <input v-model="newRoot" :class="[input, 'flex-1 font-mono']" placeholder="~/code" aria-label="Scan folder path" />
        <button type="submit" :class="btn">Add</button>
      </form>
    </SettingsSection>

    <SettingsSection title="Your emails" hint="Commits authored with these emails are treated as yours (case-insensitive).">
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="e in draft.authorEmails" :key="e"
          class="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-sm text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        >
          {{ e }}
          <button class="hover:text-red-600" :aria-label="`Remove ${e}`" @click="removeFrom('authorEmails', e)">×</button>
        </li>
        <li v-if="!draft.authorEmails.length" class="text-sm text-amber-600 dark:text-amber-400">
          No emails set: no commits will match.
        </li>
      </ul>
      <form class="flex gap-2" @submit.prevent="addEmail">
        <input v-model="newEmail" type="text" :class="[input, 'flex-1']" placeholder="you@example.com" aria-label="Add email" />
        <button type="submit" :class="btn">Add</button>
      </form>
      <div>
        <h3 class="mb-1 text-sm font-medium">Detected authors</h3>
        <p v-if="authorsLoading" class="text-sm text-slate-500">Reading git history…</p>
        <p v-else-if="!authors.length" class="text-sm text-slate-500">No authors found (add a scan folder first).</p>
        <ul v-else class="max-h-64 divide-y divide-slate-100 overflow-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <li
            v-for="a in authors" :key="a.email"
            class="flex items-center gap-3 px-3 py-1.5 text-sm"
            :class="hasEmail(a.email) ? 'bg-indigo-50/70 dark:bg-indigo-950/40' : ''"
          >
            <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
              <input type="checkbox" :checked="hasEmail(a.email)" @change="toggleEmail(a.email)" />
              <span class="truncate font-medium">{{ a.email }}</span>
              <span class="truncate text-slate-500 dark:text-slate-400">{{ (a.names?.length ? a.names : [a.name]).join(', ') }}</span>
            </label>
            <span class="tabular-nums text-slate-500 dark:text-slate-400">{{ a.commits }} commits</span>
          </li>
        </ul>
      </div>
    </SettingsSection>

    <SettingsSection title="Repos" :hint="`${includedCount} of ${store.sortedRepos.length} included. Excluded repos are hidden from the timeline.`">
      <ul class="divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        <li v-for="r in store.sortedRepos" :key="r.id" class="flex items-center gap-3 px-3 py-1.5 text-sm">
          <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
            <input type="checkbox" :checked="isIncluded(r.path)" @change="toggleRepo(r.path)" />
            <span class="font-medium" :class="isIncluded(r.path) ? '' : 'text-slate-400 line-through'">{{ r.name }}</span>
            <span class="truncate font-mono text-xs text-slate-500 dark:text-slate-400">{{ r.path }}</span>
          </label>
          <span v-if="isPinned(r.path)" class="rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">pinned</span>
        </li>
        <li v-if="!store.sortedRepos.length" class="px-3 py-2 text-sm text-slate-500">No repos found.</li>
      </ul>
      <div>
        <h3 class="mb-1 text-sm font-medium">Pinned repos</h3>
        <p class="mb-1 text-xs text-slate-500 dark:text-slate-400">Extra repo paths always included, even outside scan folders.</p>
        <ul class="space-y-1">
          <li v-for="p in draft.pinnedRepos" :key="p" class="flex items-center gap-3 font-mono text-sm">
            <span class="truncate">{{ p }}</span>
            <button :class="[rm, 'ml-auto']" @click="removeFrom('pinnedRepos', p)">Remove</button>
          </li>
        </ul>
        <form class="mt-2 flex gap-2" @submit.prevent="addTo('pinnedRepos', newPinned); newPinned = ''">
          <input v-model="newPinned" :class="[input, 'flex-1 font-mono']" placeholder="/path/to/repo" aria-label="Pin repo path" />
          <button type="submit" :class="btn">Pin</button>
        </form>
      </div>
    </SettingsSection>

    <SettingsSection title="History window" hint="How far back to read git history.">
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="sinceMode" :class="input" aria-label="History window">
          <option v-for="p in SINCE_PRESETS" :key="p.value" :value="p.value">Last {{ p.label }}</option>
          <option value="custom">Custom…</option>
        </select>
        <input
          v-if="sinceMode === 'custom'" v-model="draft.since" :class="[input, 'w-64 font-mono']"
          placeholder="18 months ago, 2025-01-01" aria-label="Custom git --since"
        />
      </div>
    </SettingsSection>

    <SettingsSection title="1:1 meetings" hint="Dates of past 1:1s, shown as markers on the timeline.">
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="m in draft.meetings" :key="m"
          class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm tabular-nums dark:bg-slate-800"
        >
          {{ m }}
          <button class="hover:text-red-600" :aria-label="`Remove ${m}`" @click="removeFrom('meetings', m)">×</button>
        </li>
        <li v-if="!draft.meetings.length" class="text-sm text-slate-500">No meetings recorded.</li>
      </ul>
      <form class="flex gap-2" @submit.prevent="addTo('meetings', newMeeting); newMeeting = ''">
        <input v-model="newMeeting" type="date" :class="input" aria-label="Meeting date" />
        <button type="submit" :class="btn" :disabled="!newMeeting">Add</button>
      </form>
    </SettingsSection>

    <details class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <summary class="cursor-pointer text-base font-semibold">Advanced</summary>
      <div class="mt-3 space-y-4 text-sm">
        <label class="block">
          <span class="font-medium">Scan depth (1–10)</span>
          <input v-model.number="draft.scanDepth" type="number" min="1" max="10" :class="[input, 'mt-1 block w-24']" />
        </label>
        <label class="block">
          <span class="font-medium">Ignored directory names (one per line)</span>
          <textarea v-model="ignoreText" rows="5" :class="[input, 'mt-1 block w-full font-mono']" />
        </label>
        <label class="block">
          <span class="font-medium">Exclude from line stats (globs, one per line)</span>
          <textarea v-model="excludeText" rows="6" :class="[input, 'mt-1 block w-full font-mono']" />
        </label>
        <label class="block">
          <span class="font-medium">Classifier keywords (JSON: type → regex list)</span>
          <textarea
            v-model="kwText" rows="6" spellcheck="false"
            :class="[input, 'mt-1 block w-full font-mono', kwParsed.error ? 'border-red-500 dark:border-red-500' : '']"
          />
          <span v-if="kwParsed.error" class="text-red-600 dark:text-red-400">Invalid JSON: {{ kwParsed.error }}</span>
        </label>
      </div>
    </details>

    <div v-if="errorMsg" class="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" role="alert">
      <p class="font-medium">{{ errorMsg }}</p>
      <ul v-if="errorDetails.length" class="mt-1 list-disc pl-5">
        <li v-for="d in errorDetails" :key="d">{{ d }}</li>
      </ul>
    </div>
    <div v-if="result?.errors.length" class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <p class="font-medium">Scan errors</p>
      <ul class="mt-1 list-disc pl-5">
        <li v-for="e in result.errors" :key="e.repoPath"><span class="font-mono">{{ e.repoPath }}</span>: {{ e.message }}</li>
      </ul>
    </div>

    <div class="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 text-sm">
        <span v-if="saving" class="text-slate-500">Saving and rescanning…</span>
        <span v-else-if="dirty" class="text-amber-600 dark:text-amber-400">● Unsaved changes</span>
        <span v-else-if="savedMsg" class="text-emerald-600 dark:text-emerald-400">{{ savedMsg }}</span>
        <span v-else class="text-slate-500">No changes</span>
        <div class="ml-auto flex gap-2">
          <button :class="btn" :disabled="!dirty || saving" @click="discard">Discard</button>
          <button
            class="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="!canSave" @click="save"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
