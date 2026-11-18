import { ref } from 'vue'

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
/** reactive prefers-color-scheme: dark */
export const prefersDark = ref(mq?.matches ?? false)
mq?.addEventListener('change', (e) => (prefersDark.value = e.matches))

/** Categorical palette (dataviz reference palette, fixed order, validated in both modes). */
export const CATEGORICAL = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}
