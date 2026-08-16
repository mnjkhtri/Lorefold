import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173/",
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
    env: { VITE_BASE_PATH: process.env.VITE_BASE_PATH ?? "/" },
    reuseExistingServer: false,
    url: "http://127.0.0.1:4173",
  },
});
