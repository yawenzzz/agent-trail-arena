import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCodexAgent } from "./agent-provisioner.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspaceRoot() {
  const dir = mkdtempSync(join(tmpdir(), "codex-provision-workspace-"));
  tempDirs.push(dir);
  return dir;
}

describe("createCodexAgent", () => {
  it("persists a runnable codex preset with createdAt and default instructions", () => {
    const workspaceRoot = makeWorkspaceRoot();

    expect(
      createCodexAgent({
        workspaceRoot,
        agentName: "Trial Agent",
        now: () => "2026-04-10T00:00:00.000Z"
      })
    ).toEqual({
      provider: "codex",
      agentId: "trial-agent",
      agentName: "Trial Agent",
      workspaceRoot
    });
  });

  it("rejects duplicate agent ids within the same workspace", () => {
    const workspaceRoot = makeWorkspaceRoot();
    createCodexAgent({
      workspaceRoot,
      agentName: "Trial Agent",
      now: () => "2026-04-10T00:00:00.000Z"
    });

    expect(() =>
      createCodexAgent({
        workspaceRoot,
        agentName: "trial---agent",
        now: () => "2026-04-10T00:00:01.000Z"
      })
    ).toThrow('Codex agent "trial-agent" already exists');
  });
});
