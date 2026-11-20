<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { mobileSidebarOpen, sidebarOpen } from '../lib/ui'
import { PanelLeft, PanelLeftClose } from '@lucide/vue'

const GITHUB_URL = 'https://github.com/riceball-tw/shiplog'

const props = defineProps<{ isDesktop: boolean }>()

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
    <RouterLink to="/" class="text-sm font-semibold tracking-tight">Shiplog</RouterLink>
    <Tooltip>
      <TooltipTrigger as-child>
        <Button variant="ghost" size="icon-sm" class="ml-auto" as-child>
          <a :href="GITHUB_URL" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" data-testid="github-link">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="size-4">
              <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.76 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
            </svg>
          </a>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">GitHub</TooltipContent>
    </Tooltip>
  </header>
</template>
