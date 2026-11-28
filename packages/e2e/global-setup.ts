import { request } from '@playwright/test'
import { BASE_URL } from './fixtures/env.js'

/** Runs after webServer is up: wait for the first scan so every test sees the synthetic commits. */
export default async function globalSetup() {
  const api = await request.newContext({ baseURL: BASE_URL })
  const res = await api.post('/api/scan')
  if (!res.ok()) throw new Error(`scan failed: ${res.status()}`)
  const r = (await res.json()) as { repos: number; errors: unknown[] }
  if (r.repos < 1 || r.errors.length) throw new Error(`unexpected scan result ${JSON.stringify(r)}`)
  await api.dispose()
}
