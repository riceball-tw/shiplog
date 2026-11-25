<script setup lang="ts">
import { ref } from 'vue'
import { download, standaloneSvg, svgToPng, type Rendered } from '../lib/mermaidImage'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

/** `diagram` is the pele render of the timeline (null: none). `v-model:timeline` shows the Include timeline option when given. */
const props = defineProps<{
  title: string
  markdown: string
  diagram?: { ok: Rendered } | { err: string } | null
  /** base file name for image downloads, without extension */
  fileBase: string
}>()
const open = defineModel<boolean>('open', { default: false })
const timeline = defineModel<boolean | undefined>('timeline', { default: undefined })

const ok = () => (props.diagram && 'ok' in props.diagram ? props.diagram.ok : null)
const imageNote = ref('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
function flash(msg: string) {
  imageNote.value = msg
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => (imageNote.value = ''), 2500)
}
function downloadSvg() {
  const d = ok()
  if (d) download(new Blob([standaloneSvg(d)], { type: 'image/svg+xml' }), `${props.fileBase}.svg`)
}
async function copyImage() {
  const d = ok()
  if (!d) return
  try {
    const png = await svgToPng(standaloneSvg(d), d.width, d.height, 2)
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      flash('Image copied ✓')
    } catch {
      download(png, `${props.fileBase}.png`) // clipboard image write unsupported
      flash('Downloaded PNG')
    }
  } catch (e) {
    flash(e instanceof Error ? e.message : 'Could not export image')
  }
}
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
async function copy() {
  try {
    await navigator.clipboard.writeText(props.markdown)
  } catch {
    // clipboard API unavailable (non-secure context): fall back to a hidden textarea
    const ta = document.createElement('textarea')
    ta.value = props.markdown
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[85vh] flex-col sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>What Copy Markdown puts on your clipboard.</DialogDescription>
      </DialogHeader>
      <div v-if="timeline !== undefined" class="flex items-center gap-2 text-sm">
        <Checkbox id="with-timeline" v-model="timeline" />
        <Label for="with-timeline" class="cursor-pointer font-normal">Include timeline</Label>
      </div>
      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto">
        <template v-if="diagram">
          <p v-if="'err' in diagram" class="text-xs text-muted-foreground">Timeline preview unavailable: {{ diagram.err }}</p>
          <!-- pele reads --pele-* from here; mapped to the app tokens so light/dark follow the page -->
          <div v-else class="pele-theme overflow-x-auto rounded-md border bg-background p-2" v-html="diagram.ok.svg" />
        </template>
        <pre class="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{{ markdown }}</pre>
      </div>
      <DialogFooter class="items-center">
        <span v-if="imageNote" class="text-xs text-muted-foreground sm:mr-auto" role="status">{{ imageNote }}</span>
        <template v-if="diagram && 'ok' in diagram">
          <Button size="sm" variant="outline" @click="copyImage">Copy image</Button>
          <Button size="sm" variant="outline" @click="downloadSvg">Download SVG</Button>
        </template>
        <Button size="sm" @click="copy">{{ copied ? 'Copied ✓' : 'Copy Markdown' }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
