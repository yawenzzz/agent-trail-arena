import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { appendCodexAgentRecord } from "./workspace-store.js";
import { resolveCodexWorkspace } from "./workspace-resolver.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspaceRoot() {
  const dir = mkdtempSync(join(tmpdir(), "codex-resolve-workspace-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveCodexWorkspace", () => {
  it("returns persisted codex agents for a workspace", () => {
    const workspaceRoot = makeWorkspaceRoot();
    appendCodexAgentRecord({
      workspaceRoot,
      record: {
        agentId: "trial-agent",
        agentName: "Trial Agent",
        workspaceRoot,
        createdAt: "2026-04-10T00:00:00.000Z",
        instructions: "Default instructions"
      }
    });

    expect(resolveCodexWorkspace({ workspaceRoot })).toEqual({
      provider: "codex",
      workspaceRoot,
      agents: [
        {
          provider: "codex",
          agentId: "trial-agent",
          agentName: "Trial Agent",
          workspaceRoot
        }
      ]
    });
  });
});
