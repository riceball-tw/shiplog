<script setup lang="ts">
import { ref } from 'vue'
import { commitKey } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { fmtShort } from '../lib/dates'
import type { Item, TicketGroup } from '../lib/summary'
import TypeBadge from './TypeBadge.vue'
import StarButton from './StarButton.vue'
import { Badge } from '@/components/ui/badge'
import { Star } from '@lucide/vue'

/** One expandable ticket (or no-ticket) group with its commits; `actions` slot sits to the right of the header. */
const props = defineProps<{ group: TicketGroup; color: (repoId: string) => string; repoName: (repoId: string) => string }>()
const store = useAppStore()
const open = ref(false)

const span = (a: number, b: number) => (fmtShort(a) === fmtShort(b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`)
const typeOf = (it: Item) => it.commit.classification.type
const types = () => [...new Set(props.group.items.map(typeOf))]
const stars = () => props.group.items.filter((it) => store.isHighlighted(commitKey(it.commit))).length
</script>

<template>
  <div>
    <div class="flex items-start">
      <button class="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50" :aria-expanded="open" @click="open = !open">
        <span class="mt-0.5 w-3 shrink-0 text-muted-foreground">{{ open ? '▾' : '▸' }}</span>
        <span class="min-w-0 flex-1">
          <span class="line-clamp-2 break-words" :title="group.title">
            <span class="font-mono font-semibold" :class="group.key === null && 'text-muted-foreground'">{{ group.key ?? 'No ticket' }}</span>
            <span v-if="group.key !== null && group.title" class="ml-2">{{ group.title }}</span>
            <span v-else-if="group.key === null && group.repoIds.length === 1" class="ml-2 text-muted-foreground">{{ repoName(group.repoIds[0]!) }}</span>
          </span>
          <span class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            <TypeBadge v-for="t in types()" :key="t" :type="t" />
            <Badge v-for="r in group.repoIds" :key="r" variant="secondary">
              <span class="size-2 rounded-sm" :style="{ background: color(r) }" />{{ repoName(r) }}
            </Badge>
            <span>· {{ group.items.length }} {{ group.items.length === 1 ? 'commit' : 'commits' }} · {{ span(group.first, group.last) }}</span>
            <span v-if="stars()" class="inline-flex items-center gap-0.5 text-amber-500" :aria-label="`${stars()} highlighted`">
              <Star class="size-3 fill-current" />{{ stars() }}
            </span>
          </span>
        </span>
      </button>
      <div v-if="$slots.actions" class="shrink-0 py-1.5 pr-2"><slot name="actions" /></div>
    </div>
    <ul v-if="open" class="space-y-1 bg-muted/40 px-3 py-2 pl-9 text-sm">
      <li v-for="it in group.items" :key="commitKey(it.commit)" class="flex items-center gap-2">
        <span class="w-14 shrink-0 text-xs text-muted-foreground">{{ fmtShort(it.ts) }}</span>
        <TypeBadge class="shrink-0" :type="typeOf(it)" />
        <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
        <span v-if="group.key === null && it.commit.classification.scope" class="shrink-0 text-xs text-muted-foreground">{{ it.commit.classification.scope }}</span>
        <StarButton :pressed="store.isHighlighted(commitKey(it.commit))" @toggle="store.toggleHighlight(commitKey(it.commit))" />
      </li>
    </ul>
  </div>
</template>
