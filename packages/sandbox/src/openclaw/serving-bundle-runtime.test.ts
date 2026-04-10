import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { applyOpenClawServingBundle } from "./serving-bundle-applier.js";
import { resolveOpenClawServingRuntimeConfig } from "./serving-bundle-runtime.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeStateRoot() {
  const dir = mkdtempSync(join(tmpdir(), "openclaw-serving-runtime-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveOpenClawServingRuntimeConfig", () => {
  it("reads the currently applied serving runtime config", async () => {
    const stateRoot = makeStateRoot();
    await applyOpenClawServingBundle({
      stateRoot,
      runtimeConfig: {
        bundleVersionId: "bundle-0004",
        prompt: "Use the applied serving bundle.",
        memory: ["Keep the applied memory."],
        knowledge: ["Keep the applied knowledge."]
      }
    });

    const resolved = await resolveOpenClawServingRuntimeConfig({ stateRoot });

    expect(resolved).toEqual(
      expect.objectContaining({
        bundleVersionId: "bundle-0004",
        prompt: "Use the applied serving bundle.",
        memory: ["Keep the applied memory."],
        knowledge: ["Keep the applied knowledge."],
        applied: expect.objectContaining({
          stateRoot
        })
      })
    );
  });
});
