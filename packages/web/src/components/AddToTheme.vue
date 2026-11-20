<script setup lang="ts">
import type { Theme } from '@shiplog/shared'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'

const NEW = '__new__'
defineProps<{ themes: Theme[] }>()
/** themeId, or null for "New theme…" */
const emit = defineEmits<{ pick: [themeId: string | null] }>()
const onPick = (v: unknown) => typeof v === 'string' && emit('pick', v === NEW ? null : v)
</script>

<template>
  <Select @update:model-value="onPick">
    <SelectTrigger size="sm" class="shrink-0" aria-label="Add to theme">
      <SelectValue placeholder="Add to theme" />
    </SelectTrigger>
    <SelectContent align="end">
      <SelectItem v-for="t in themes" :key="t.id" :value="t.id">{{ t.name || 'Untitled theme' }}</SelectItem>
      <SelectSeparator v-if="themes.length" />
      <SelectItem :value="NEW">New theme…</SelectItem>
    </SelectContent>
  </Select>
</template>
