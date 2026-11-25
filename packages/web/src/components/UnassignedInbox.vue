<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useAppStore } from '../stores/app'
import type { TicketGroup } from '../lib/summary'
import { clearSelect, rangeSelect, toggleSelect, unitOfGroup, type WorkUnit } from '../lib/workDrag'
import { drag, endDrag, startDrag, useDropTarget } from '../lib/useWorkDrag'
import TicketRow from './TicketRow.vue'
import AddToTheme from './AddToTheme.vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'

/** The Unassigned inbox: drag source (multi-select), drop target (= unassign), keyboard 1-9 / N. */
const props = defineProps<{ groups: TicketGroup[]; color: (repoId: string) => string; repoName: (repoId: string) => string }>()
const emit = defineEmits<{ place: [themeId: string | null, units: WorkUnit[]]; placeNew: [units: WorkUnit[]]; focus: [on: boolean] }>()
const store = useAppStore()
const root = useTemplateRef<HTMLElement>('root')

// narrow layout: the header collapses the list; wide layout always shows it
const open = ref(true)
const units = computed(() => props.groups.map(unitOfGroup))
const order = computed(() => units.value.map((u) => u.id))
const sel = ref<string[]>([])
let anchor: string | null = null
watch(order, (o) => (sel.value = sel.value.filter((id) => o.includes(id))))

/** the selection when `id` is part of it, else just that row */
function unitsFor(id: string): WorkUnit[] {
  if (!sel.value.includes(id)) return units.value.filter((u) => u.id === id)
  return units.value.filter((u) => sel.value.includes(u.id))
}
// capture phase: modifier clicks select instead of expanding the row
function onClick(e: MouseEvent, id: string) {
  if (e.shiftKey) sel.value = rangeSelect(order.value, anchor ?? id, id, sel.value)
  else if (e.metaKey || e.ctrlKey) {
    sel.value = toggleSelect(sel.value, id)
    anchor = id
  } else return
  e.preventDefault()
  e.stopPropagation()
}
const rows = () => [...(root.value?.querySelectorAll<HTMLElement>('[data-row]') ?? [])]
const focusRow = (i: number) => rows()[Math.max(0, Math.min(i, rows().length - 1))]?.focus()
function onKey(e: KeyboardEvent, id: string, i: number) {
  if (e.target !== e.currentTarget || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    focusRow(i + (e.key === 'ArrowDown' ? 1 : -1))
  } else if (e.key === ' ') {
    e.preventDefault()
    sel.value = toggleSelect(sel.value, id)
    anchor = id
  } else if (/^[1-9]$/.test(e.key)) {
    const theme = store.notes.themes[+e.key - 1]
    if (!theme) return
    e.preventDefault()
    const us = unitsFor(id)
    sel.value = clearSelect()
    emit('place', theme.id, us)
    nextTick(() => focusRow(i)) // the row left the list; keep the cursor where it was
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    emit('placeNew', unitsFor(id))
  }
}
function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && sel.value.length && !document.querySelector('[role=dialog]')) sel.value = clearSelect()
}
onMounted(() => window.addEventListener('keydown', onEsc))
onBeforeUnmount(() => window.removeEventListener('keydown', onEsc))

function onFocusOut(e: FocusEvent) {
  if (!root.value?.contains(e.relatedTarget as Node | null)) emit('focus', false)
}
// only work that lives in a theme can be dropped here
const { over, handlers } = useDropTarget((us) => emit('place', null, us), () => drag.value?.from != null)
</script>

<template>
  <section
    ref="root"
    aria-label="Unassigned"
    class="rounded-md border bg-card @3xl:sticky @3xl:top-16 @3xl:max-h-[calc(100vh-5rem)] @3xl:overflow-y-auto"
    :class="over && 'ring-2 ring-primary'"
    data-testid="unassigned"
    @focusin="emit('focus', true)"
    @focusout="onFocusOut"
    v-on="handlers"
  >
    <button
      class="flex w-full items-center gap-1 px-3 py-2 text-left text-sm font-semibold @3xl:cursor-default"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component :is="open ? ChevronDown : ChevronRight" class="size-4 @3xl:hidden" />
      Unassigned <span class="font-normal text-muted-foreground">({{ groups.length }})</span>
      <span v-if="sel.length" class="ml-auto text-xs font-normal text-muted-foreground">{{ sel.length }} selected · Esc clears</span>
    </button>
    <div :class="!open && '@max-3xl:hidden'">
      <p v-if="over" class="px-3 pb-2 text-sm font-medium text-primary">Drop to unassign</p>
      <p v-else-if="!groups.length" class="px-3 pb-2 text-sm text-muted-foreground">Drag work here to take it out of a theme.</p>
      <p v-else class="px-3 pb-2 text-xs text-muted-foreground">Drag onto a theme, or focus a row and press 1–9 (N = new theme).</p>
      <ul class="divide-y border-t">
        <li
          v-for="(g, i) in groups"
          :key="units[i]!.id"
          data-row
          tabindex="0"
          draggable="true"
          aria-keyshortcuts="1 2 3 4 5 6 7 8 9 N"
          class="cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          :class="sel.includes(units[i]!.id) && 'bg-primary/10'"
          @click.capture="onClick($event, units[i]!.id)"
          @keydown="onKey($event, units[i]!.id, i)"
          @dragstart="startDrag($event, unitsFor(units[i]!.id), null)"
          @dragend="endDrag"
        >
          <TicketRow :group="g" :color="color" :repo-name="repoName">
            <template #actions>
              <AddToTheme
                :themes="store.notes.themes"
                @pick="(id) => (id === null ? emit('placeNew', [units[i]!]) : emit('place', id, [units[i]!]))"
              />
            </template>
          </TicketRow>
        </li>
      </ul>
    </div>
  </section>
</template>
