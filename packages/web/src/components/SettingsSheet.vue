<script setup lang="ts">
import { defineAsyncComponent, h } from 'vue'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { useSettingsSheet } from '../lib/ui'

// the form (and the folder browser it opens) loads on first open, keeping the main chunk small
const SettingsPanel = defineAsyncComponent({
  loader: () => import('./settings/SettingsPanel.vue'),
  loadingComponent: { render: () => h('p', { class: 'p-6 text-sm text-muted-foreground' }, 'Loading settings…') },
  delay: 150,
})
const { open, section, closeSettings } = useSettingsSheet()
</script>

<template>
  <Sheet :open="open" @update:open="(o) => !o && closeSettings()">
    <SheetContent
      side="right"
      class="w-full! gap-0 p-0 sm:max-w-xl! xl:max-w-2xl!"
      data-testid="settings-sheet"
    >
      <SettingsPanel :section="section" />
    </SheetContent>
  </Sheet>
</template>
