<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { useSettingsSheet } from '../lib/ui'
import { Button } from '@/components/ui/button'
import { Check } from '@lucide/vue'

const store = useAppStore()
const { openSettings } = useSettingsSheet()
const cfg = computed(() => store.config)
const hasFolders = computed(() => !!cfg.value && (cfg.value.scanRoots.length > 0 || cfg.value.pinnedRepos.length > 0))
const hasEmails = computed(() => !!cfg.value && cfg.value.authorEmails.length > 0)

const steps = computed(() => [
  {
    done: hasFolders.value,
    title: 'Add the folder that holds your repos',
    body: hasFolders.value
      ? cfg.value!.scanRoots.join(', ') || `${cfg.value!.pinnedRepos.length} pinned repos`
      : 'Repos are found recursively, so one parent folder like ~/code is usually enough.',
    action: hasFolders.value ? 'Change' : 'Add folder',
    section: 'folders' as const,
  },
  {
    done: hasEmails.value,
    title: 'Pick the emails you commit with',
    body: hasEmails.value
      ? cfg.value!.authorEmails.join(', ')
      : 'Only commits by these authors are shown. Choose them from the authors found in your repos.',
    action: hasEmails.value ? 'Change' : 'Choose emails',
    section: 'emails' as const,
  },
])
</script>

<template>
  <div class="mx-auto max-w-xl py-8 sm:py-16" data-testid="setup-guide">
    <h1 class="text-xl font-semibold tracking-tight">Set up your timeline</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      One-on-One reads the git history on this machine and keeps only your commits, so you can see what you shipped before a 1:1.
    </p>

    <ol class="mt-6 divide-y rounded-xl border bg-card">
      <li v-for="(s, i) in steps" :key="s.section" class="flex items-start gap-3 p-4">
        <span
          class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
          :class="s.done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'text-muted-foreground'"
        >
          <Check v-if="s.done" class="size-3.5" /><template v-else>{{ i + 1 }}</template>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">{{ s.title }}</p>
          <p class="mt-0.5 text-xs text-muted-foreground" :class="s.done && 'truncate font-mono'" :title="s.done ? s.body : undefined">{{ s.body }}</p>
        </div>
        <Button :variant="s.done ? 'ghost' : 'default'" size="sm" @click="openSettings(s.section)">{{ s.action }}</Button>
      </li>
      <li class="flex items-start gap-3 p-4">
        <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground">3</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium">Save &amp; rescan</p>
          <p class="mt-0.5 text-xs text-muted-foreground">Settings open as a panel on the right; the timeline fills in here as soon as the scan finishes.</p>
        </div>
      </li>
    </ol>
    <p class="mt-4 text-xs text-muted-foreground">
      Nothing leaves your machine. Settings are stored in <span class="font-mono">~/.one-on-one/config.json</span>.
    </p>
  </div>
</template>
