<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string; description: string; confirmLabel: string }>()
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :show-close-button="false">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button variant="destructive" @click="emit('confirm'), (open = false)">{{ confirmLabel }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
