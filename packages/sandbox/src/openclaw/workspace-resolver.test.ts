import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveOpenClawWorkspace } from "./workspace-resolver.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

function makeWorkspace(): string {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "openclaw-workspace-"));
  tempDirs.push(workspaceRoot);
  return workspaceRoot;
}

describe("resolveOpenClawWorkspace", () => {
  it("returns stable agent descriptors from a valid workspace", async () => {
    const workspaceRoot = makeWorkspace();
    const openclawRoot = join(workspaceRoot, ".openclaw");
    const agentsRoot = join(openclawRoot, "agents");

    mkdirSync(agentsRoot, { recursive: true });
    writeFileSync(
      join(agentsRoot, "prod-agent.json"),
      JSON.stringify({ name: "prod-agent" }, null, 2)
    );

    const result = await resolveOpenClawWorkspace({ workspaceRoot });

    expect(result.workspaceRoot).toBe(workspaceRoot);
    expect(result.openclawRoot).toBe(openclawRoot);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]).toMatchObject({
      agentName: "prod-agent",
      definitionPath: join(agentsRoot, "prod-agent.json"),
      workspaceRoot
    });
    expect(result.agents[0].agentId).toMatch(/^openclaw_[a-f0-9]{16}$/);
  });

  it("rejects workspaces without .openclaw", async () => {
    const workspaceRoot = makeWorkspace();

    await expect(resolveOpenClawWorkspace({ workspaceRoot })).rejects.toThrow(
      `Missing .openclaw directory under workspace root: ${workspaceRoot}`
    );
  });

  it("rejects malformed agent definitions", async () => {
    const workspaceRoot = makeWorkspace();
    const openclawRoot = join(workspaceRoot, ".openclaw");
    const agentsRoot = join(openclawRoot, "agents");

    mkdirSync(agentsRoot, { recursive: true });
    writeFileSync(join(agentsRoot, "broken.json"), "{not-json");

    await expect(resolveOpenClawWorkspace({ workspaceRoot })).rejects.toThrow(
      `Malformed OpenClaw agent definition at ${join(agentsRoot, "broken.json")}`
    );
  });

  it("rejects definitions without a string name", async () => {
    const workspaceRoot = makeWorkspace();
    const agentsRoot = join(workspaceRoot, ".openclaw", "agents");

    mkdirSync(agentsRoot, { recursive: true });
    writeFileSync(join(agentsRoot, "missing-name.json"), JSON.stringify({ prompt: "hi" }, null, 2));

    await expect(resolveOpenClawWorkspace({ workspaceRoot })).rejects.toThrow(
      `Malformed OpenClaw agent definition at ${join(agentsRoot, "missing-name.json")}: missing string name`
    );
  });

  it("rejects duplicate discovered agent names", async () => {
    const workspaceRoot = makeWorkspace();
    const agentsRoot = join(workspaceRoot, ".openclaw", "agents");

    mkdirSync(join(agentsRoot, "nested"), { recursive: true });
    writeFileSync(join(agentsRoot, "one.json"), JSON.stringify({ name: "dup-agent" }, null, 2));
    writeFileSync(
      join(agentsRoot, "nested", "two.json"),
      JSON.stringify({ name: "dup-agent" }, null, 2)
    );

    await expect(resolveOpenClawWorkspace({ workspaceRoot })).rejects.toThrow(
      `Duplicate OpenClaw agent name "dup-agent" found in workspace ${workspaceRoot}`
    );
  });

  it("keeps agent identifiers stable across repeated discovery", async () => {
    const workspaceRoot = makeWorkspace();
    const openclawRoot = join(workspaceRoot, ".openclaw");
    const agentsRoot = join(openclawRoot, "agents");

    mkdirSync(agentsRoot, { recursive: true });
    const definitionPath = join(agentsRoot, "stable-agent.json");
    writeFileSync(definitionPath, JSON.stringify({ name: "stable-agent" }, null, 2));

    const first = await resolveOpenClawWorkspace({ workspaceRoot });
    const second = await resolveOpenClawWorkspace({ workspaceRoot });

    expect(first.agents[0].agentId).toBe(second.agents[0].agentId);
    expect(first.agents[0]).toMatchObject({
      agentName: "stable-agent",
      definitionPath
    });
  });
});
