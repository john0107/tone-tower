import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: path.join(os.tmpdir(), 'tone-tower-browser-results'),
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4175',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'small-phone',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 640 } },
    },
  ],
  webServer: {
    command: 'node tools/server/serve.mjs --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: !process.env.CI,
  },
});
