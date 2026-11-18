<script setup lang="ts">
import type { Classification } from '@one-on-one/shared'
import { COMMIT_TYPE_COLORS } from '../lib/commitTypes'

defineProps<{ classification: Classification }>()
</script>

<template>
  <span
    class="inline-block rounded px-1.5 py-0.5 text-xs font-medium"
    :class="[COMMIT_TYPE_COLORS[classification.type].badge, classification.confidence === 'low' && 'opacity-50']"
    :title="classification.confidence === 'low' ? 'Guessed by heuristic' : 'Conventional Commit'"
  >
    {{ classification.type }}{{ classification.breaking ? '!' : '' }}
  </span>
</template>
