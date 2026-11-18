import { onBeforeUnmount, type Ref, watch } from 'vue'
import type VChart from 'vue-echarts'
import { useAppStore } from '../stores/app'
import { dayEnd, dayStart } from './dates'

const THROTTLE_MS = 100

/**
 * Two-way sync between an ECharts dataZoom (index 0) and store.range.
 * - chart -> store: throttled (~100ms, trailing edge kept), snapped to whole days
 * - store -> chart: dispatchAction with silent:true so it never echoes back
 * `lastEmitted` lets a chart ignore the store update that it caused itself.
 */
export function useRangeSync(chart: Ref<InstanceType<typeof VChart> | null | undefined>) {
  const store = useAppStore()
  let lastEmitted: { from: number; to: number } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastRun = 0
  let pending: (() => void) | null = null

  function read() {
    const dz = (chart.value?.getOption() as any)?.dataZoom?.[0]
    if (dz?.startValue == null || dz?.endValue == null) return null
    return { from: Number(dz.startValue), to: Number(dz.endValue) }
  }

  function flush() {
    timer = null
    lastRun = Date.now()
    pending?.()
    pending = null
  }

  /** wire to the chart's @datazoom */
  function onDataZoom() {
    pending = () => {
      const r = read()
      if (!r) return
      const next = { from: dayStart(r.from), to: dayEnd(r.to) }
      lastEmitted = next
      store.setRange(next)
    }
    const wait = THROTTLE_MS - (Date.now() - lastRun)
    if (wait <= 0) flush()
    else if (!timer) timer = setTimeout(flush, wait)
  }

  /** push store.range into the chart; force = re-apply even if we caused the change (after option rebuild) */
  function apply(force = false) {
    const c = chart.value
    if (!c) return
    const { from, to } = store.range
    if (!force && lastEmitted && lastEmitted.from === from && lastEmitted.to === to) return
    const cur = read()
    if (cur && Math.abs(cur.from - from) < 1000 && Math.abs(cur.to - to) < 1000) return
    c.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: from, endValue: to }, { silent: true })
  }

  /**
   * wire to the chart's @finished: only the first render needs the initial window.
   * `finished` also fires on every frame of a drag, and forcing the (throttled, day-snapped)
   * store range back in then fights the user's handle.
   */
  let initialized = false
  function onFinished() {
    if (initialized) return
    initialized = true
    apply(true)
  }

  watch(() => store.range, () => apply())
  onBeforeUnmount(() => timer && clearTimeout(timer))

  return { onDataZoom, onFinished, apply }
}
