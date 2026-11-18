<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import RangePresets from '../components/RangePresets.vue'
import RepoList from '../components/RepoList.vue'
import CommitList from '../components/CommitList.vue'

const store = useAppStore()
onMounted(() => {
  store.loadRepos()
  store.loadCommits()
})
</script>

<template>
  <div class="space-y-6">
    <RangePresets />
    <div
      class="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    >
      Timeline — coming in phase 3
    </div>
    <div class="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <RepoList />
      <CommitList />
    </div>
  </div>
</template>
