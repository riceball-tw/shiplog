<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from '@lucide/vue'

const store = useAppStore()
const result = computed(() => store.lastScan)
const errors = computed(() => result.value?.errors ?? [])
</script>

<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button variant="outline" size="sm" class="h-7 text-xs" :disabled="store.scanning" data-testid="rescan" @click="store.scan()">
        <RefreshCw :class="store.scanning && 'animate-spin'" />
        {{ store.scanning ? 'Scanning…' : 'Rescan' }}
        <span v-if="errors.length && !store.scanning" class="text-destructive">· {{ errors.length }} errors</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" class="max-w-sm">
      <p>Re-read git history with the saved settings</p>
      <p v-if="result" class="opacity-80">
        Last scan: {{ result.newCommits }} new commits · {{ (result.durationMs / 1000).toFixed(1) }}s
      </p>
      <p v-for="e in errors" :key="e.repoPath" class="opacity-80">{{ e.repoPath }}: {{ e.message }}</p>
    </TooltipContent>
  </Tooltip>
</template>
