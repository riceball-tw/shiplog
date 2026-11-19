<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ title }}</CardTitle>
      <CardDescription v-if="hint">{{ hint }}</CardDescription>
    </CardHeader>
    <CardContent class="space-y-3"><slot /></CardContent>
  </Card>
</template>
