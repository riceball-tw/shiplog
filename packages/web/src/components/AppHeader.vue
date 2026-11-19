<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { mobileSidebarOpen, settingsDirty, sidebarOpen, useSettingsSheet } from '../lib/ui'
import { PanelLeft, PanelLeftClose, RefreshCw, Settings2 } from '@lucide/vue'

const props = defineProps<{ isDesktop: boolean }>()
const store = useAppStore()
const { open: settingsOpen, openSettings, closeSettings } = useSettingsSheet()
const result = computed(() => store.lastScan)
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const sidebarShown = computed(() => (props.isDesktop ? sidebarOpen.value : mobileSidebarOpen.value))
function toggleSidebar() {
  if (props.isDesktop) sidebarOpen.value = !sidebarOpen.value
  else mobileSidebarOpen.value = !mobileSidebarOpen.value
}
</script>

<template>
  <header class="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-4">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost" size="icon-sm" :aria-pressed="sidebarShown"
          :aria-label="sidebarShown ? 'Hide sidebar' : 'Show sidebar'" data-testid="sidebar-toggle"
          @click="toggleSidebar"
        >
          <component :is="sidebarShown ? PanelLeftClose : PanelLeft" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{{ sidebarShown ? 'Hide' : 'Show' }} repos &amp; data source</TooltipContent>
    </Tooltip>
    <RouterLink to="/" class="text-sm font-semibold tracking-tight">One-on-One</RouterLink>

    <div class="ml-auto flex items-center gap-2 text-sm">
      <span v-if="result" class="hidden text-xs text-muted-foreground md:inline">
        Last scan: {{ result.newCommits }} new commits · {{ (result.durationMs / 1000).toFixed(1) }}s
        <span
          v-if="result.errors.length" class="text-destructive"
          :title="result.errors.map((e) => `${e.repoPath}: ${e.message}`).join('\n')"
        >· {{ result.errors.length }} errors</span>
      </span>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="outline" size="sm" :disabled="store.scanning" @click="store.scan()">
            <RefreshCw :class="store.scanning && 'animate-spin'" />
            {{ store.scanning ? 'Scanning…' : 'Rescan' }}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Re-read git history with the saved settings</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline" size="sm" class="relative" :aria-pressed="settingsOpen" data-testid="settings-toggle"
            :class="settingsOpen && 'bg-muted'"
            @click="settingsOpen ? closeSettings() : openSettings()"
          >
            <Settings2 />Settings
            <span
              v-if="settingsDirty" class="absolute -top-1 -right-1 size-2.5 rounded-full border-2 border-background bg-amber-500"
              aria-label="Unsaved settings"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Data source: folders, emails, repos ({{ isMac ? '⌘' : 'Ctrl' }} ,){{ settingsDirty ? ' · unsaved changes' : '' }}
        </TooltipContent>
      </Tooltip>
    </div>
  </header>
</template>
