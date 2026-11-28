import { defineConfig, devices } from '@playwright/test'

import { BASE_URL, PORT } from './fixtures/env.js'

export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  // one shared server and one notes.json: tests run serially and reset notes in a fixture
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  // the healthy suite takes ~30s; a broken build once ran past 40 min, so fail the whole run instead of hanging
  globalTimeout: 10 * 60_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    viewport: { width: 1440, height: 900 },
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } }, // headless Firefox can't launch in the sandbox
  ],
  webServer: {
    command: 'node --import tsx fixtures/serve.ts',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    env: { PORT: String(PORT) },
  },
})
