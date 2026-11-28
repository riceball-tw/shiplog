import { computed } from 'vue'
import { useAppStore } from '../stores/app'
import { prefersDark } from './theme'

/** repo display name and theme-aware color, shared by the panels that list work */
export function useRepoLookup() {
  const store = useAppStore()
  const names = computed(() => Object.fromEntries(store.repos.map((r) => [r.id, r.name])))
  const repoName = (id: string) => names.value[id] ?? id
  const color = (id: string) => {
    const c = store.repoColors.get(id)
    return c ? (prefersDark.value ? c.dark : c.light) : '#94a3b8'
  }
  return { repoNames: names, repoName, color }
}
