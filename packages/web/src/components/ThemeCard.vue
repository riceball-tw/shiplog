<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { commitKey, type Theme } from '@shiplog/shared'
import { useAppStore } from '../stores/app'
import { fmtShort } from '../lib/dates'
import type { ThemeCardData } from '../lib/summary'
import TicketRow from './TicketRow.vue'
import StarButton from './StarButton.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChevronDown, ChevronUp, Trash2, X } from '@lucide/vue'

/** `data` is absent for a theme with no work in the current range (still editable). */
const props = defineProps<{
  theme: Theme
  data?: ThemeCardData
  color: (repoId: string) => string
  repoName: (repoId: string) => string
  canUp: boolean
  canDown: boolean
}>()
defineEmits<{ up: []; down: [] }>()

const store = useAppStore()
const showWork = ref(false)
const root = useTemplateRef<{ $el: HTMLElement }>('root')
// the themes timeline asks for this card: expand the work list and scroll to it (immediate: the card may mount after the request)
watch(
  () => store.themeFocus,
  (f) => {
    if (f?.id !== props.theme.id) return
    showWork.value = true
    store.clearThemeFocus()
    nextTick(() => root.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  },
  { immediate: true },
)
const confirmDelete = ref(false)
const span = (a: number, b: number) => (fmtShort(a) === fmtShort(b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`)
const ticketCount = computed(() => props.data?.tickets.filter((g) => g.key !== null).length ?? 0)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
</script>

<template>
  <Card ref="root" class="gap-0 py-0" data-testid="theme-card">
    <div class="space-y-2 p-3">
      <div class="flex items-center gap-1">
        <Input
          :model-value="theme.name"
          class="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-base font-semibold shadow-none hover:border-input"
          placeholder="Theme name"
          aria-label="Theme name"
          @update:model-value="(v) => store.renameTheme(theme.id, String(v))"
        />
        <Button variant="ghost" size="icon-sm" :disabled="!canUp" aria-label="Move theme up" @click="$emit('up')"><ChevronUp /></Button>
        <Button variant="ghost" size="icon-sm" :disabled="!canDown" aria-label="Move theme down" @click="$emit('down')"><ChevronDown /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Delete theme" @click="confirmDelete = true"><Trash2 /></Button>
      </div>
      <Textarea
        :model-value="theme.outcome"
        rows="1"
        class="min-h-0 resize-none border-transparent bg-transparent px-1.5 py-1 shadow-none hover:border-input"
        placeholder="What changed because of this? e.g. cut checkout p95 from 800 to 300 ms"
        aria-label="Outcome"
        @update:model-value="(v) => store.setOutcome(theme.id, String(v))"
      />
      <p v-if="data" class="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-1.5 text-xs text-muted-foreground">
        <span>{{ span(data.first, data.last) }}</span>
        <Badge v-for="r in data.repoIds" :key="r" variant="secondary">
          <span class="size-2 rounded-sm" :style="{ background: color(r) }" />{{ repoName(r) }}
        </Badge>
        <span>· {{ plural(ticketCount, 'ticket') }} · {{ plural(data.items.length, 'commit') }}</span>
      </p>
    </div>

    <template v-if="data">
      <ul v-if="data.highlights.length" class="space-y-1 border-t px-3 py-2 text-sm" aria-label="Highlights">
        <li v-for="it in data.highlights" :key="commitKey(it.commit)" class="flex items-center gap-2">
          <StarButton :pressed="true" @toggle="store.toggleHighlight(commitKey(it.commit))" />
          <span class="min-w-0 flex-1 truncate" :title="it.commit.subject">{{ it.title }}</span>
          <Badge v-for="t in it.commit.tickets" :key="t" variant="secondary" class="shrink-0">{{ t }}</Badge>
        </li>
      </ul>
      <button class="border-t px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50" :aria-expanded="showWork" @click="showWork = !showWork">
        {{ showWork ? '▾' : '▸' }} Work in this theme
      </button>
      <ul v-if="showWork" class="divide-y border-t">
        <li v-for="g in data.tickets" :key="g.key ?? '__none'">
          <TicketRow :group="g" :color="color" :repo-name="repoName">
            <template #actions>
              <Button
                variant="ghost"
                size="icon-sm"
                :aria-label="`Remove ${g.key ?? 'these commits'} from theme`"
                title="Remove from theme"
                @click="store.unassign(theme.id, { tickets: g.key ? [g.key] : [], commits: g.items.map((i) => commitKey(i.commit)) })"
              ><X /></Button>
            </template>
          </TicketRow>
        </li>
      </ul>
    </template>
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="`Delete theme &quot;${theme.name || 'Untitled theme'}&quot;?`"
      description="This only removes the grouping. Your commits are never touched."
      confirm-label="Delete theme"
      @confirm="store.deleteTheme(theme.id)"
    />
  </Card>
</template>
