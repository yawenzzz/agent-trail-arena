import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyOpenClawServingBundle,
  readAppliedOpenClawServingBundle,
  resolveOpenClawServingBundlePath
} from "./serving-bundle-applier.js";

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
  const dir = mkdtempSync(join(tmpdir(), "openclaw-serving-bundle-"));
  tempDirs.push(dir);
  return dir;
}

describe("applyOpenClawServingBundle", () => {
  it("writes the serving runtime config into the OpenClaw state root", async () => {
    const stateRoot = makeStateRoot();
    const result = await applyOpenClawServingBundle({
      stateRoot,
      runtimeConfig: {
        bundleVersionId: "bundle-0002",
        prompt: "Use rollout status before retrying.",
        memory: ["Acknowledge corrections before retries."],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });

    expect(result.appliedBundlePath).toBe(resolveOpenClawServingBundlePath(stateRoot));
    const written = JSON.parse(readFileSync(result.appliedBundlePath, "utf8"));
    expect(written.runtimeConfig).toEqual({
      bundleVersionId: "bundle-0002",
      prompt: "Use rollout status before retrying.",
      memory: ["Acknowledge corrections before retries."],
      knowledge: ["Use rollout status before retrying the same command."]
    });
  });

  it("reads back the applied serving runtime config from the OpenClaw state root", async () => {
    const stateRoot = makeStateRoot();
    await applyOpenClawServingBundle({
      stateRoot,
      runtimeConfig: {
        bundleVersionId: "bundle-0003",
        prompt: "Use the active serving bundle.",
        memory: ["Keep the latest serving memory."],
        knowledge: ["Keep the latest serving knowledge."]
      }
    });

    const applied = await readAppliedOpenClawServingBundle({ stateRoot });

    expect(applied).toEqual({
      stateRoot,
      configPath: join(stateRoot, "openclaw.json"),
      appliedBundlePath: resolveOpenClawServingBundlePath(stateRoot),
      runtimeConfig: {
        bundleVersionId: "bundle-0003",
        prompt: "Use the active serving bundle.",
        memory: ["Keep the latest serving memory."],
        knowledge: ["Keep the latest serving knowledge."]
      }
    });
  });
});
