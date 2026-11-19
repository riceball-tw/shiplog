<script setup lang="ts">
import type { Classification, CommitType } from '@shiplog/shared'
import { COMMIT_TYPE_COLORS } from '../lib/commitTypes'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{ classification?: Classification; type?: CommitType; confident?: boolean }>()
const t = () => props.classification?.type ?? props.type ?? 'other'
</script>

<template>
  <Badge
    variant="secondary"
    class="h-auto rounded px-1.5 py-0.5"
    :class="[COMMIT_TYPE_COLORS[t()].badge, classification?.confidence === 'low' && 'opacity-50']"
    :title="classification ? (classification.confidence === 'low' ? 'Guessed by heuristic' : 'Conventional Commit') : undefined"
  >
    <slot>{{ t() }}{{ classification?.breaking ? '!' : '' }}</slot>
  </Badge>
</template>
