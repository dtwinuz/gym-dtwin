import { defineConfig } from '@playwright/test'

// Smoke test of the static demo (npm run build:demo first): every route renders, no console errors.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4174',
    viewport: { width: 1280, height: 800 },
    ...(process.env.PW_CHROMIUM ? { launchOptions: { executablePath: process.env.PW_CHROMIUM } } : {}),
  },
  webServer: { command: 'node scripts/demo-server.mjs', env: { PORT: '4174' }, url: 'http://localhost:4174/demo/gym/', reuseExistingServer: false },
})
