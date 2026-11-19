import { ref } from 'vue'
import type { AppConfig } from '@one-on-one/shared'

/**
 * Settings form state at module level, so an unsaved draft survives closing and reopening the
 * sheet (the panel component unmounts on close). Only the lazy settings chunk imports this.
 */
export const draft = ref<AppConfig | null>(null)
export const baseline = ref('')
export const ignoreText = ref('')
export const excludeText = ref('')
export const kwText = ref('{}')
export const sinceMode = ref<string>('12 months ago')

export const SINCE_PRESETS = [3, 6, 12, 24].map((n) => ({ value: `${n} months ago`, label: `${n} months` }))

export function loadDraft(cfg: AppConfig) {
  draft.value = JSON.parse(JSON.stringify(cfg))
  ignoreText.value = cfg.ignoreDirs.join('\n')
  excludeText.value = cfg.excludeFromStats.join('\n')
  kwText.value = JSON.stringify(cfg.classifier.keywords, null, 2)
  sinceMode.value = SINCE_PRESETS.some((p) => p.value === cfg.since) ? cfg.since : 'custom'
  baseline.value = JSON.stringify(cfg)
}
