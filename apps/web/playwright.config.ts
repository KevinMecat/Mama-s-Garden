import { defineConfig } from "@playwright/test";

const python = process.env.QA_PYTHON ?? "python";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60000,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    viewport: { width: 1440, height: 1000 },
    channel: process.env.QA_BROWSER_CHANNEL || undefined,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `"${python}" ../../scripts/workforce_qa_server.py --confirm-isolated`,
      url: "http://127.0.0.1:8218/api/v1/health/",
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3002",
      url: "http://127.0.0.1:3002/login",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:8218" },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
