<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { mobileSidebarOpen, sidebarOpen } from '../lib/ui'
import { PanelLeft, PanelLeftClose } from '@lucide/vue'

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
  </header>
</template>
