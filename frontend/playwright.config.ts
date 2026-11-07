import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', workers: 1, retries: 0,
  use: { baseURL: 'http://localhost:3100', headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } : {} },
  webServer: { command: 'npm run start -- --hostname localhost --port 3100', url: 'http://localhost:3100/icon.svg', reuseExistingServer: !process.env.CI, timeout: 120000 },
});
