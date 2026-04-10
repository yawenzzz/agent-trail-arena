import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendCodexAgentRecord,
  readCodexAgentRecords,
  resolveCodexAgentStorePath
} from "./workspace-store.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function makeWorkspaceRoot() {
  const dir = mkdtempSync(join(tmpdir(), "codex-workspace-"));
  tempDirs.push(dir);
  return dir;
}

describe("codex workspace store", () => {
  it("persists and reads codex agent records from a workspace-local metadata file", () => {
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

    expect(readCodexAgentRecords({ workspaceRoot })).toEqual([
      {
        agentId: "trial-agent",
        agentName: "Trial Agent",
        workspaceRoot,
        createdAt: "2026-04-10T00:00:00.000Z",
        instructions: "Default instructions"
      }
    ]);
    expect(resolveCodexAgentStorePath(workspaceRoot)).toBe(
      join(workspaceRoot, ".trial-arena", "codex-agents.json")
    );
  });

  it("throws a discovery error when the persisted codex metadata is malformed", () => {
    const workspaceRoot = makeWorkspaceRoot();
    const storePath = resolveCodexAgentStorePath(workspaceRoot);
    mkdirSync(join(workspaceRoot, ".trial-arena"), { recursive: true });
    writeFileSync(storePath, "{not-json}", "utf8");

    expect(() => readCodexAgentRecords({ workspaceRoot })).toThrow(
      `Malformed Codex agent discovery for ${storePath}`
    );
  });
});
