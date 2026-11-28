<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventListener } from '@vueuse/core'
import { useAppStore } from '../stores/app'
import { dayEnd, fmtShort, parseYmd, ymd } from '../lib/dates'
import { buildSlides, slideIndex, slideLabel, type SlideTicket } from '../lib/slides'
import { CATEGORICAL, prefersDark } from '../lib/theme'
import ThemeGantt from '../components/ThemeGantt.vue'
import ThemeStrip from '../components/ThemeStrip.vue'
import { Button } from '@/components/ui/button'
import { Star, X } from '@lucide/vue'

const MAX_CHIPS = 6

const store = useAppStore()
const route = useRoute()
const router = useRouter()

// range from the URL (a refresh lands here directly); otherwise the store's range goes into the URL
const from = parseYmd(route.query.from)
const to = parseYmd(route.query.to)
if (from != null && to != null) store.setRange({ from, to: dayEnd(to) })
else router.replace({ query: { ...route.query, from: ymd(store.range.from), to: ymd(store.range.to) } })
onMounted(() => {
  // coming from the main view the data is already here
  if (!store.allCommits.length && !store.repos.length) store.init()
  nextTick(focusStage)
})

const slides = computed(() => buildSlides({ commits: store.keptCommits, notes: store.notes, range: store.range }))
const index = computed(() => slideIndex(route.query.slide, slides.value.length))
const slide = computed(() => slides.value[index.value]!)
const count = computed(() => slides.value.length)
const label = computed(() => `Slide ${index.value + 1} of ${count.value}: ${slideLabel(slide.value)}`)

function go(i: number) {
  const n = Math.min(Math.max(i, 0), count.value - 1)
  if (n !== index.value) router.replace({ query: { ...route.query, slide: String(n + 1) } })
}
const next = () => go(index.value + 1)
const prev = () => go(index.value - 1)
function close() {
  router.push({ path: '/', query: { from: ymd(store.range.from), to: ymd(store.range.to) } })
}

const stage = useTemplateRef<HTMLElement>('stage')
function focusStage() {
  stage.value?.focus({ preventScroll: true })
}
watch(index, () => nextTick(focusStage))

useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  // Space/Enter on a focused control belong to that control
  const onControl = e.target instanceof Element && !!e.target.closest('a, button')
  switch (e.key) {
    case 'ArrowRight':
    case 'PageDown':
      return void (e.preventDefault(), next())
    case 'ArrowLeft':
    case 'PageUp':
      return void (e.preventDefault(), prev())
    case ' ':
      if (onControl) return
      return void (e.preventDefault(), e.shiftKey ? prev() : next())
    case 'Home':
      return void (e.preventDefault(), go(0))
    case 'End':
      return void (e.preventDefault(), go(count.value - 1))
    case 'Escape':
      return close()
  }
})

/** right half advances, left half goes back; links and buttons keep their own behaviour */
function onClick(e: MouseEvent) {
  if ((e.target as Element).closest('a, button')) return
  if (window.getSelection()?.toString()) return
  if (e.clientX > window.innerWidth / 2) next()
  else prev()
}

const repoName = (id: string) => store.repos.find((r) => r.id === id)?.name ?? id
const repoColor = (id: string) => {
  const c = store.repoColors.get(id)
  return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
}
const themeColor = (i: number) => {
  const p = prefersDark.value ? CATEGORICAL.dark : CATEGORICAL.light
  return p[Math.max(0, i) % p.length]!
}
const plural = (n: number, w: string) => `${n.toLocaleString()} ${w}${n === 1 ? '' : 's'}`
const span = (a: number, b: number) => (fmtShort(a) === fmtShort(b) ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`)
const ticketLabel = (t: SlideTicket) => t.key ?? 'No ticket'
</script>

<template>
  <div class="fixed inset-0 z-50 flex flex-col bg-background text-foreground" data-testid="present" @click="onClick">
    <Button variant="ghost" size="icon" class="absolute right-4 top-4 z-10 text-muted-foreground" aria-label="Exit presentation (Esc)" title="Exit (Esc)" @click="close">
      <X />
    </Button>
    <p class="sr-only" role="status" aria-live="polite">{{ label }}</p>

    <main ref="stage" tabindex="-1" class="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-[clamp(1.5rem,7vw,7rem)] py-16 outline-none" :aria-label="label">
      <p v-if="store.loading && !store.allCommits.length" class="text-2xl text-muted-foreground">Loading…</p>
      <Transition v-else name="slide" mode="out-in">
        <!-- title -->
        <section v-if="slide.kind === 'title'" :key="slide.id" class="w-full max-w-6xl">
          <h1 class="text-[clamp(2.25rem,6vw,5.5rem)] font-semibold leading-tight tracking-tight">{{ slide.label }}</h1>
          <p v-if="slide.author" class="mt-4 truncate text-[clamp(1.25rem,2.4vw,2.25rem)] text-muted-foreground" :title="slide.author">{{ slide.author }}</p>
          <dl class="mt-[clamp(2rem,6vw,5rem)] grid grid-cols-3 gap-[clamp(1rem,4vw,4rem)]">
            <div v-for="[n, l] in [[slide.themes, 'themes'], [slide.tickets, 'tickets'], [slide.repos, 'repos']] as const" :key="l">
              <dd class="text-[clamp(3rem,10vw,9rem)] font-semibold leading-none tabular-nums">{{ n.toLocaleString() }}</dd>
              <dt class="mt-2 text-[clamp(1rem,2vw,1.75rem)] text-muted-foreground">{{ l }}</dt>
            </div>
          </dl>
          <p class="mt-[clamp(2rem,5vw,4rem)] text-base text-muted-foreground">{{ plural(slide.commits, 'commit') }}</p>
        </section>

        <!-- overview -->
        <section v-else-if="slide.kind === 'overview'" :key="slide.id" class="w-full max-w-7xl">
          <h2 class="mb-6 text-[clamp(1.75rem,3.5vw,3rem)] font-semibold tracking-tight">The year in themes</h2>
          <ThemeGantt present />
        </section>

        <!-- theme -->
        <section v-else-if="slide.kind === 'theme'" :key="slide.id" class="w-full max-w-6xl space-y-[clamp(1.25rem,2.6vw,2.5rem)]">
          <div>
            <h2 class="flex items-center gap-3 text-[clamp(1.25rem,2.6vw,2.25rem)] font-semibold tracking-tight text-muted-foreground">
              <span class="size-4 shrink-0 rounded-full" :style="{ background: themeColor(slide.colorIdx) }" />
              <span class="min-w-0 truncate" :title="slide.name">{{ slide.name }}</span>
            </h2>
            <p
              v-if="slide.hasOutcome"
              class="mt-3 line-clamp-4 text-[clamp(1.75rem,4.2vw,3.75rem)] font-semibold leading-tight tracking-tight"
              :title="slide.outcome"
            >{{ slide.outcome }}</p>
            <p v-else class="mt-3 text-[clamp(1.5rem,3.2vw,2.75rem)] italic leading-tight text-muted-foreground">No outcome written yet</p>
          </div>

          <div class="space-y-3">
            <p class="text-[clamp(0.95rem,1.4vw,1.25rem)] text-muted-foreground">
              {{ span(slide.first, slide.last) }} · {{ plural(slide.commits, 'commit') }}
            </p>
            <ThemeStrip :row="slide.row" :range="store.range" :color="themeColor(slide.colorIdx)" />
            <ul class="flex flex-wrap gap-2 pt-1" aria-label="Repos">
              <li
                v-for="id in slide.repoIds.slice(0, MAX_CHIPS)"
                :key="id"
                class="flex max-w-64 items-center gap-2 rounded-full border px-3 py-1 text-[clamp(0.875rem,1.3vw,1.125rem)]"
              >
                <span class="size-2.5 shrink-0 rounded-full" :style="{ background: repoColor(id) }" />
                <span class="truncate" :title="repoName(id)">{{ repoName(id) }}</span>
              </li>
              <li v-if="slide.repoIds.length > MAX_CHIPS" class="px-1 py-1 text-[clamp(0.875rem,1.3vw,1.125rem)] text-muted-foreground">+{{ slide.repoIds.length - MAX_CHIPS }} more</li>
            </ul>
          </div>

          <div class="grid gap-[clamp(1.5rem,3vw,3rem)] lg:grid-cols-5">
            <div v-if="slide.highlights.length" class="min-w-0 lg:col-span-3" :class="{ 'lg:col-span-5': !slide.tickets.length }">
              <h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Highlights</h3>
              <ul class="space-y-2.5">
                <li v-for="(h, i) in slide.highlights" :key="i" class="flex items-baseline gap-3 text-[clamp(1.1rem,2vw,1.75rem)] leading-snug">
                  <Star class="size-[0.8em] shrink-0 translate-y-0.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  <span class="line-clamp-2 min-w-0" :title="h.title">{{ h.title }}</span>
                  <span v-if="h.tickets.length" class="shrink-0 font-mono text-[0.6em] text-muted-foreground">{{ h.tickets.join(', ') }}</span>
                </li>
              </ul>
              <p v-if="slide.moreHighlights" class="mt-2 text-base text-muted-foreground">+{{ slide.moreHighlights }} more starred</p>
            </div>
            <div v-if="slide.tickets.length" class="min-w-0" :class="slide.highlights.length ? 'lg:col-span-2' : 'lg:col-span-5'">
              <h3 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Top tickets</h3>
              <ul class="space-y-2">
                <li v-for="t in slide.tickets" :key="t.key ?? ''" class="flex items-baseline gap-3 text-[clamp(0.95rem,1.5vw,1.25rem)]">
                  <span class="shrink-0 font-mono text-muted-foreground">{{ t.key }}</span>
                  <span class="min-w-0 flex-1 truncate" :title="t.title">{{ t.title }}</span>
                  <span class="shrink-0 tabular-nums text-muted-foreground">{{ t.commits }}</span>
                </li>
              </ul>
              <p v-if="slide.moreTickets" class="mt-2 text-base text-muted-foreground">+{{ slide.moreTickets }} more</p>
            </div>
          </div>
        </section>

        <!-- other work -->
        <section v-else :key="slide.id" class="w-full max-w-5xl">
          <h2 class="text-[clamp(1.75rem,3.5vw,3rem)] font-semibold tracking-tight">Other work</h2>
          <p class="mt-2 text-[clamp(1rem,1.8vw,1.5rem)] text-muted-foreground">{{ plural(slide.commits, 'commit') }} not in any theme</p>
          <ul class="mt-8 space-y-3">
            <li v-for="t in slide.tickets" :key="ticketLabel(t) + t.title" class="flex items-baseline gap-4 text-[clamp(1rem,1.8vw,1.5rem)]">
              <span class="w-28 shrink-0 truncate font-mono text-muted-foreground" :title="ticketLabel(t)">{{ ticketLabel(t) }}</span>
              <span class="min-w-0 flex-1 truncate" :title="t.title">{{ t.title }}</span>
              <span class="shrink-0 tabular-nums text-muted-foreground">{{ plural(t.commits, 'commit') }}</span>
            </li>
          </ul>
          <p v-if="slide.moreTickets" class="mt-4 text-base text-muted-foreground">+{{ slide.moreTickets }} more</p>
        </section>
      </Transition>
    </main>

    <!-- progress -->
    <div class="flex items-center justify-between px-6 pb-3 text-sm text-muted-foreground">
      <span class="hidden sm:inline">← → to navigate · Esc to exit</span>
      <span class="ml-auto tabular-nums" aria-hidden="true">{{ index + 1 }} / {{ count }}</span>
    </div>
    <div class="h-1 w-full bg-muted" aria-hidden="true">
      <div class="h-full bg-foreground/60 transition-[width] motion-reduce:transition-none" :style="{ width: ((index + 1) / count) * 100 + '%' }" />
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.18s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
