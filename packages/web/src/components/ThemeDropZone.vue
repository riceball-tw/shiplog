<script setup lang="ts">
import type { WorkUnit } from '../lib/workDrag'
import { useDropTarget } from '../lib/useWorkDrag'

/** Compact drop target shown while dragging: a collapsed theme, or the dashed "New theme" zone. */
defineProps<{ label: string; number?: number; dashed?: boolean }>()
const emit = defineEmits<{ drop: [units: WorkUnit[]] }>()
const { over, handlers } = useDropTarget((units) => emit('drop', units))
</script>

<template>
  <div
    class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground"
    :class="[dashed ? 'border border-dashed' : 'border bg-card', over && 'border-primary bg-primary/10 text-primary ring-2 ring-primary']"
    data-testid="theme-drop-zone"
    v-on="handlers"
  >
    <kbd v-if="number" class="rounded border bg-muted px-1.5 font-mono text-xs text-foreground">{{ number }}</kbd>
    <span class="min-w-0 truncate">{{ over ? `Drop to add to ${label}` : label }}</span>
  </div>
</template>
