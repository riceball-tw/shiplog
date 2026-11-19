import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { MemoryCommitStore } from '../src/store.js'

describe('Host header guard', () => {
  const { app } = createApp({ store: new MemoryCommitStore() })
  const hit = (host?: string) => app.request('/api/health', { headers: host ? { Host: host } : {} })

  it('rejects foreign hosts and missing host', async () => {
    expect((await hit('evil.com')).status).toBe(403)
    expect((await hit('evil.com:4317')).status).toBe(403)
    expect((await hit('127.0.0.1.evil.com')).status).toBe(403)
    expect((await hit()).status).toBe(403)
  })
  it('allows loopback hosts on any port', async () => {
    for (const h of ['127.0.0.1:4317', 'localhost:5173', 'localhost', 'LOCALHOST:3000', '[::1]:4317']) {
      expect((await hit(h)).status, h).toBe(200)
    }
  })
})
