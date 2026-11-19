<script setup lang="ts">
defineProps<{ id: string; title: string; hint?: string }>()
</script>

<template>
  <section :id="id" class="scroll-mt-2 space-y-3 px-5 py-5" :aria-labelledby="id + '-title'">
    <header>
      <h3 :id="id + '-title'" class="text-sm font-semibold">{{ title }}</h3>
      <p v-if="hint" class="mt-0.5 text-xs text-muted-foreground">{{ hint }}</p>
    </header>
    <slot />
  </section>
</template>
