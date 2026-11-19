<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { Button } from '@/components/ui/button'
import { Loader2, Settings } from '@lucide/vue'

const store = useAppStore()
const result = computed(() => store.lastScan)
</script>

<template>
  <header class="border-b bg-card">
    <div class="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
      <RouterLink to="/" class="text-lg font-semibold">One-on-One</RouterLink>
      <RouterLink
        v-if="$route.path !== '/'"
        to="/"
        class="text-sm text-primary hover:underline"
      >
        ← Timeline
      </RouterLink>
      <div class="ml-auto flex items-center gap-3 text-sm">
        <span v-if="result" class="text-muted-foreground">
          {{ result.newCommits }} new commits in {{ result.durationMs }} ms
          <span v-if="result.errors.length" class="text-destructive"
            :title="result.errors.map((e) => `${e.repoPath}: ${e.message}`).join('\n')">
            · {{ result.errors.length }} errors
          </span>
        </span>
        <Button as-child variant="outline" :class="$route.path === '/settings' && 'bg-muted'" title="Settings">
          <RouterLink to="/settings"><Settings />Settings</RouterLink>
        </Button>
        <Button :disabled="store.scanning" @click="store.scan()">
          <Loader2 v-if="store.scanning" class="animate-spin" />
          {{ store.scanning ? 'Scanning…' : 'Rescan' }}
        </Button>
      </div>
    </div>
  </header>
</template>
