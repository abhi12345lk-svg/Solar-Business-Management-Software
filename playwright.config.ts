import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'e2e-report.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/
    },
    {
      name: 'Desktop Chrome',
      use: {
        viewport: { width: 1280, height: 720 },
        storageState: 'playwright/.auth/admin.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'Tablet',
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: 'playwright/.auth/admin.json'
      },
      dependencies: ['setup']
    },
    {
      name: 'Mobile Chrome',
      use: {
        viewport: { width: 375, height: 667 },
        isMobile: true,
        storageState: 'playwright/.auth/admin.json'
      },
      dependencies: ['setup']
    }
  ]
});
