import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3007",
    channel: "msedge",
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3007",
    url: "http://127.0.0.1:3007",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      LOO_DATA_DIR: `e2e-${Date.now()}`,
      DATABASE_URL: "",
      BLUE_ACCESS_CODE: "",
      RED_ACCESS_CODE: "",
      SESSION_SECRET: "loo-isolated-e2e-session-secret-not-for-production",
      APP_ORIGIN: "",
      VERCEL: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      LOO_TIMEZONE: "America/Toronto",
    },
  },
});
