<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import SettingsSheet from './components/SettingsSheet.vue'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { mobileSidebarOpen, sidebarOpen, useSettingsSheet } from './lib/ui'

/** lg breakpoint: the sidebar sits inline above it and becomes a slide-over below it */
const isDesktop = useMediaQuery('(min-width: 1024px)')
const { open: settingsOpen, openSettings } = useSettingsSheet()

// ⌘/Ctrl + , opens settings (the usual app convention)
useEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === ',' && !settingsOpen.value) {
    e.preventDefault()
    openSettings()
  }
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <div class="min-h-screen bg-background text-foreground">
      <AppHeader :is-desktop="isDesktop" />
      <div class="flex">
        <aside
          v-if="isDesktop && sidebarOpen"
          class="sticky top-12 h-[calc(100dvh-3rem)] w-72 shrink-0 border-r bg-sidebar text-sidebar-foreground"
          aria-label="View filters and data source"
        >
          <AppSidebar />
        </aside>
        <main class="@container min-w-0 flex-1 px-4 py-4 lg:px-6">
          <RouterView />
        </main>
      </div>

      <Sheet v-if="!isDesktop" v-model:open="mobileSidebarOpen">
        <SheetContent side="left" class="w-80! gap-0 bg-sidebar p-0 pt-10">
          <SheetTitle class="sr-only">Filters</SheetTitle>
          <SheetDescription class="sr-only">Repo visibility and data source</SheetDescription>
          <AppSidebar />
        </SheetContent>
      </Sheet>

      <SettingsSheet />
    </div>
  </TooltipProvider>
</template>
