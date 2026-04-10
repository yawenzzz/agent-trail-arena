import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("run-capability-watcher script", () => {
  it("documents file-backed watcher entrypoints in the package script", () => {
    const packageJson = JSON.parse(readFileSync("apps/api/package.json", "utf8"));

    expect(packageJson.scripts["watch:capability"]).toBe(
      "tsx scripts/run-capability-watcher.ts"
    );
  });
});
