import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Commit, Repo, ScanResult } from '@one-on-one/shared'
import * as api from '../api'

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString()

export function presetRange(preset: 'twoWeeks' | 'month' | 'threeMonths') {
  const now = new Date()
  const to = iso(now)
  if (preset === 'twoWeeks') return { from: iso(new Date(now.getTime() - 14 * DAY)), to }
  if (preset === 'month') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  return { from: iso(new Date(now.getTime() - 90 * DAY)), to }
}

export const useAppStore = defineStore('app', () => {
  const repos = ref<Repo[]>([])
  const commits = ref<Commit[]>([])
  const loading = ref(false)
  const scanning = ref(false)
  const error = ref<string | null>(null)
  const lastScan = ref<ScanResult | null>(null)
  const range = ref(presetRange('twoWeeks'))

  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

  async function loadRepos() {
    try {
      repos.value = await api.getRepos()
      error.value = null
    } catch (e) {
      error.value = msg(e)
    }
  }

  async function loadCommits() {
    loading.value = true
    try {
      commits.value = await api.getCommits(range.value)
      error.value = null
    } catch (e) {
      error.value = msg(e)
    } finally {
      loading.value = false
    }
  }

  async function scan() {
    scanning.value = true
    try {
      lastScan.value = await api.scan()
      error.value = null
      await Promise.all([loadRepos(), loadCommits()])
    } catch (e) {
      error.value = msg(e)
    } finally {
      scanning.value = false
    }
  }

  async function setRange(r: { from: string; to: string }) {
    range.value = r
    await loadCommits()
  }

  return { repos, commits, loading, scanning, error, lastScan, range, loadRepos, loadCommits, scan, setRange }
})
