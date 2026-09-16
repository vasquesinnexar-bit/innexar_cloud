import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://portal.innexar.com.br",
    ignoreHTTPSErrors: false,
    viewport: { width: 1366, height: 900 },
  },
});
