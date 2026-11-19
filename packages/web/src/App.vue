<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import SettingsSheet from './components/SettingsSheet.vue'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <AppHeader />
    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
    <SettingsSheet />
  </div>
</template>
