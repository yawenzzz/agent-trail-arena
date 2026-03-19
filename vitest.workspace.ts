import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/domain",
  "packages/registry",
  "packages/sandbox",
  "packages/judge",
  "packages/orchestrator",
  "apps/web",
  "apps/api"
]);
