<script setup lang="ts">
import { Star } from '@lucide/vue'

/** Highlight toggle for a commit row. Stops the click so it doesn't select the row. */
defineProps<{ pressed: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="shrink-0 rounded p-0.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    :class="pressed ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'"
    :aria-pressed="pressed"
    :aria-label="pressed ? 'Remove highlight' : 'Highlight this commit'"
    :title="pressed ? 'Remove highlight' : 'Highlight this commit'"
    @click.stop="$emit('toggle')"
  >
    <Star class="size-4" :class="pressed && 'fill-current'" />
  </button>
</template>
