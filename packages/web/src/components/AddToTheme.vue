<script setup lang="ts">
import type { Theme } from '@shiplog/shared'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger } from '@/components/ui/select'
import { FolderInput } from '@lucide/vue'

const NEW = '__new__'
defineProps<{ themes: Theme[] }>()
/** themeId, or null for "New theme…" */
const emit = defineEmits<{ pick: [themeId: string | null] }>()
const onPick = (v: unknown) => typeof v === 'string' && emit('pick', v === NEW ? null : v)
</script>

<template>
  <Select @update:model-value="onPick">
    <!-- icon-only: drag and number keys are the main path, this is the touch fallback -->
    <SelectTrigger size="sm" class="shrink-0 gap-0.5 border-transparent px-1.5 text-muted-foreground hover:border-input" aria-label="Add to theme" title="Add to theme">
      <FolderInput class="size-3.5" />
    </SelectTrigger>
    <SelectContent align="end">
      <SelectItem v-for="t in themes" :key="t.id" :value="t.id">{{ t.name || 'Untitled theme' }}</SelectItem>
      <SelectSeparator v-if="themes.length" />
      <SelectItem :value="NEW">New theme…</SelectItem>
    </SelectContent>
  </Select>
</template>
