import { ref } from 'vue'

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
/** reactive prefers-color-scheme: dark */
export const prefersDark = ref(mq?.matches ?? false)

/** shadcn uses a `.dark` class on <html>; mirror the OS preference onto it. */
function applyDark(dark: boolean) {
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('dark', dark)
}
applyDark(prefersDark.value) // runs at import time, before mount -> no flash
mq?.addEventListener('change', (e) => {
  prefersDark.value = e.matches
  applyDark(e.matches)
})

/** Categorical palette (dataviz reference palette, fixed order, validated in both modes). */
export const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

/** Neutral color for every repo outside the top N ("Other"). */
export const OTHER_COLOR = { light: '#9ca3af', dark: '#6b7280' }
