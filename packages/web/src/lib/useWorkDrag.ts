import { ref, watch } from 'vue'
import type { WorkUnit } from './workDrag'

/** what is being dragged right now (dragover can't read dataTransfer, so it lives here); `from` is the source theme id or null for the inbox */
export const drag = ref<{ units: WorkUnit[]; from: string | null } | null>(null)

export function startDrag(e: DragEvent, units: WorkUnit[], from: string | null) {
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', `${units.length} work item(s)`)
  drag.value = { units, from }
}
export const endDrag = () => (drag.value = null)

// the source row may be gone by drop time (it moved), so dragend alone isn't reliable
if (typeof window !== 'undefined') {
  for (const ev of ['dragend', 'drop'] as const) window.addEventListener(ev, () => setTimeout(endDrag, 0))
}

/** Drop-target handlers + `over` flag; `canDrop` filters by the current drag (e.g. not onto its own theme). */
export function useDropTarget(onDrop: (units: WorkUnit[], from: string | null) => void, canDrop: () => boolean = () => true) {
  const over = ref(false)
  let depth = 0
  const ok = () => !!drag.value && canDrop()
  watch(drag, (d) => {
    if (!d) {
      over.value = false
      depth = 0
    }
  })
  return {
    over,
    handlers: {
      dragenter(e: DragEvent) {
        if (!ok()) return
        e.preventDefault()
        depth++
        over.value = true
      },
      dragover(e: DragEvent) {
        if (!ok()) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      },
      dragleave() {
        if (!ok()) return
        if (--depth <= 0) {
          depth = 0
          over.value = false
        }
      },
      drop(e: DragEvent) {
        if (!ok()) return
        e.preventDefault()
        const d = drag.value!
        depth = 0
        over.value = false
        onDrop(d.units, d.from)
      },
    },
  }
}
