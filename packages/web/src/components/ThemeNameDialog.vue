<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [name: string] }>()

const name = ref('')
watch(open, (o) => o && (name.value = ''))
const trimmed = () => name.value.trim()
function submit() {
  if (!trimmed()) return
  emit('submit', trimmed())
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent :show-close-button="false">
      <form class="grid gap-4" @submit.prevent="submit">
        <DialogHeader>
          <DialogTitle>New theme</DialogTitle>
          <DialogDescription>A theme is one story you will tell in a review.</DialogDescription>
        </DialogHeader>
        <div class="grid gap-2">
          <Label for="theme-name">Name</Label>
          <Input id="theme-name" v-model="name" autofocus required maxlength="200" placeholder="e.g. Checkout performance" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">Cancel</Button>
          <Button type="submit" :disabled="!trimmed()">Create theme</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
