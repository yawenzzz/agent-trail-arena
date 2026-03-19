import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/domain",
      "packages/registry",
      "packages/sandbox",
      "packages/judge",
      "packages/orchestrator",
      "apps/web",
      "apps/api"
    ]
  }
});
