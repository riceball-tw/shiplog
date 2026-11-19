import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loadPref, savePref } from './prefs'

/** Desktop sidebar (lg+) open state, remembered across reloads. */
export const sidebarOpen = ref(loadPref('oo.sidebar', ['open', 'closed'] as const, 'open') === 'open')
watch(sidebarOpen, (v) => savePref('oo.sidebar', v ? 'open' : 'closed'))

/** Mobile (<lg) sidebar sheet; not persisted. */
export const mobileSidebarOpen = ref(false)

/** Set by the (lazy) settings panel so the header can show an "unsaved" dot while the sheet is closed. */
export const settingsDirty = ref(false)

export const SETTINGS_SECTIONS = ['folders', 'emails', 'repos', 'history', 'advanced'] as const
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]

/**
 * Settings live in a sheet over the timeline. Its open state is the `settings` query param
 * (`?settings=1` or `?settings=<section>`), so it can be deep-linked and survives reloads;
 * the range params (`from`/`to`) are left untouched.
 */
export function useSettingsSheet() {
  const route = useRoute()
  const router = useRouter()
  const param = computed(() => {
    const v = route.query.settings
    return typeof v === 'string' && v ? v : null
  })
  const open = computed(() => param.value != null)
  const section = computed<SettingsSection | null>(() =>
    SETTINGS_SECTIONS.includes(param.value as SettingsSection) ? (param.value as SettingsSection) : null,
  )
  function openSettings(s?: SettingsSection) {
    mobileSidebarOpen.value = false
    router.replace({ path: '/', query: { ...route.query, settings: s ?? '1' } })
  }
  function closeSettings() {
    const { settings: _drop, ...rest } = route.query
    router.replace({ path: '/', query: rest })
  }
  return { open, section, openSettings, closeSettings }
}
