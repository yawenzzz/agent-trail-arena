import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000"
  },
  webServer: [
    {
      command: "pnpm --dir apps/api exec node --import tsx src/server.ts",
      port: 3001,
      reuseExistingServer: true,
      timeout: 120000
    },
    {
      command:
        "OPENCLAW_API_BASE_URL=http://127.0.0.1:3001 pnpm --dir apps/web start --hostname 127.0.0.1 --port 3000",
      port: 3000,
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
});
