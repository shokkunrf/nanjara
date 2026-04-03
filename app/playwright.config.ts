import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30000,
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'https://localhost:4173',
    ignoreHTTPSErrors: true,
  },
});
