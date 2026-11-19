<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <h2 class="text-base font-semibold">{{ title }}</h2>
    <p v-if="hint" class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ hint }}</p>
    <div class="mt-3 space-y-3"><slot /></div>
  </section>
</template>
