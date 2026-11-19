<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { DirListing } from '@shiplog/shared'
import * as api from '../api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowUp, Folder, Home } from '@lucide/vue'

const props = defineProps<{ title?: string; initialPath?: string }>()
const emit = defineEmits<{ select: [path: string]; close: [] }>()

const listing = ref<DirListing | null>(null)
const loading = ref(false)
const error = ref('')
let seq = 0

async function go(path?: string): Promise<boolean> {
  const mine = ++seq
  loading.value = true
  error.value = ''
  try {
    const l = await api.listDir(path)
    if (mine !== seq) return true
    listing.value = l
    return true
  } catch (e) {
    if (mine === seq) error.value = e instanceof Error ? e.message : String(e)
    return false
  } finally {
    if (mine === seq) loading.value = false
  }
}

const crumbs = computed(() => {
  const p = listing.value?.path
  if (!p) return []
  const parts = p.split('/').filter(Boolean)
  return [{ label: '/', path: '/' }, ...parts.map((name, i) => ({ label: name, path: '/' + parts.slice(0, i + 1).join('/') }))]
})

onMounted(async () => {
  const start = props.initialPath?.trim()
  // fall back to home when the typed value is not a valid dir
  if (!start || !(await go(start))) await go()
})

</script>

<template>
  <Dialog :open="true" @update:open="(o) => !o && emit('close')">
    <DialogContent class="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl" :show-close-button="false">
      <DialogHeader class="border-b p-4">
        <DialogTitle>{{ title ?? 'Choose a folder' }}</DialogTitle>
        <DialogDescription class="sr-only">Browse to a directory and select it.</DialogDescription>
        <nav class="mt-2 flex flex-wrap items-center gap-0.5 font-mono text-sm" aria-label="Current path">
          <template v-for="(c, i) in crumbs" :key="c.path">
            <span v-if="i > 1" class="text-muted-foreground">/</span>
            <Button
              variant="ghost"
              size="xs"
              class="px-1"
              :class="i === crumbs.length - 1 ? 'font-semibold' : 'text-primary'"
              @click="go(c.path)"
            >
              {{ c.label }}
            </Button>
          </template>
        </nav>
        <div class="mt-2 flex gap-2">
          <Button variant="outline" size="sm" :disabled="!listing?.parent || loading" @click="go(listing!.parent!)"><ArrowUp />Up</Button>
          <Button variant="outline" size="sm" :disabled="loading" @click="go(listing?.home)"><Home />Home</Button>
        </div>
      </DialogHeader>

      <div class="min-h-48 flex-1 overflow-auto p-2">
        <Alert v-if="error" variant="destructive" class="m-2 w-auto">
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
        <p v-if="loading && !listing" class="p-2 text-sm text-muted-foreground">Loading…</p>
        <ul v-if="listing" :class="loading ? 'opacity-50' : ''">
          <li v-for="e in listing.entries" :key="e.path">
            <button
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              @click="go(e.path)"
            >
              <Folder class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span class="truncate">{{ e.name }}</span>
              <Badge v-if="e.isGitRepo" variant="secondary" class="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">git</Badge>
            </button>
          </li>
          <li v-if="!listing.entries.length && !loading" class="p-2 text-sm text-muted-foreground">No subfolders.</li>
        </ul>
      </div>

      <div class="flex items-center gap-3 border-t p-4">
        <span class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground" :title="listing?.path">{{ listing?.path }}</span>
        <Button variant="outline" @click="emit('close')">Cancel</Button>
        <Button :disabled="!listing || loading" @click="emit('select', listing!.path)">Select this folder</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
