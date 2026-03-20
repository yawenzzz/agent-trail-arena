import { describe, expect, it, vi } from "vitest";
import { createOpenClawAgent } from "./agent-provisioner.js";
import type { ResolvedOpenClawWorkspace } from "./types.js";

function makeResolvedWorkspace(
  workspaceRoot: string,
  agents: ResolvedOpenClawWorkspace["agents"]
): ResolvedOpenClawWorkspace {
  return {
    workspaceRoot,
    openclawRoot: `${workspaceRoot}/.openclaw`,
    agents
  };
}

describe("createOpenClawAgent", () => {
  it("rejects duplicate names before invoking the CLI", async () => {
    const runCommand = vi.fn();
    const resolveWorkspace = vi.fn();

    await expect(
      createOpenClawAgent({
        workspaceRoot: "/tmp/openclaw-workspace",
        agentName: "prod-agent",
        existingAgents: [
          {
            agentId: "a1",
            agentName: "prod-agent",
            definitionPath: "/tmp/openclaw-workspace/.openclaw/agents/prod-agent.json",
            workspaceRoot: "/tmp/openclaw-workspace"
          }
        ],
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow('OpenClaw agent "prod-agent" already exists');

    expect(runCommand).not.toHaveBeenCalled();
    expect(resolveWorkspace).not.toHaveBeenCalled();
  });

  it("rejects invalid names before invoking the CLI", async () => {
    const runCommand = vi.fn();
    const resolveWorkspace = vi.fn();

    await expect(
      createOpenClawAgent({
        workspaceRoot: "/tmp/openclaw-workspace",
        agentName: "bad name",
        existingAgents: [],
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow('Invalid OpenClaw agent name "bad name"');

    expect(runCommand).not.toHaveBeenCalled();
    expect(resolveWorkspace).not.toHaveBeenCalled();
  });

  it("constructs the add command and refreshes discovery before returning the new descriptor", async () => {
    const workspaceRoot = "/tmp/openclaw-workspace";
    const createdAgent = {
      agentId: "openclaw_abcd1234ef567890",
      agentName: "fresh-agent",
      definitionPath: `${workspaceRoot}/.openclaw/agents/fresh-agent.json`,
      workspaceRoot
    };
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce(makeResolvedWorkspace(workspaceRoot, []))
      .mockResolvedValueOnce(makeResolvedWorkspace(workspaceRoot, [createdAgent]));
    const runCommand = vi.fn().mockResolvedValue(undefined);

    const result = await createOpenClawAgent({
      workspaceRoot: `${workspaceRoot}/../openclaw-workspace`,
      agentName: "fresh-agent",
      runCommand,
      resolveWorkspace
    });

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith({
      args: [
        "agents",
        "add",
        "--workspace",
        workspaceRoot,
        "--name",
        "fresh-agent"
      ]
    });
    expect(resolveWorkspace).toHaveBeenCalledTimes(2);
    expect(resolveWorkspace).toHaveBeenNthCalledWith(1, {
      workspaceRoot
    });
    expect(resolveWorkspace).toHaveBeenNthCalledWith(2, {
      workspaceRoot
    });
    expect(result).toBe(createdAgent);
  });

  it("surfaces CLI failures with useful command context", async () => {
    const workspaceRoot = "/tmp/openclaw-workspace";
    const runCommand = vi
      .fn()
      .mockRejectedValue(new Error("OpenClaw command failed (openclaw agents add --workspace /tmp/openclaw-workspace --name broken-agent): missing binary"));
    const resolveWorkspace = vi.fn().mockResolvedValue(makeResolvedWorkspace(workspaceRoot, []));

    await expect(
      createOpenClawAgent({
        workspaceRoot,
        agentName: "broken-agent",
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow("OpenClaw command failed (openclaw agents add --workspace /tmp/openclaw-workspace --name broken-agent)");

    expect(resolveWorkspace).toHaveBeenCalledTimes(1);
  });

  it("fails when refreshed discovery does not contain the created agent", async () => {
    const workspaceRoot = "/tmp/openclaw-workspace";
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce(makeResolvedWorkspace(workspaceRoot, []))
      .mockResolvedValueOnce(
        makeResolvedWorkspace(workspaceRoot, [
          {
            agentId: "openclaw_existing",
            agentName: "existing-agent",
            definitionPath: `${workspaceRoot}/.openclaw/agents/existing-agent.json`,
            workspaceRoot
          }
        ])
      );
    const runCommand = vi.fn().mockResolvedValue(undefined);

    await expect(
      createOpenClawAgent({
        workspaceRoot,
        agentName: "missing-after-refresh",
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow(
      "Agent creation did not produce a definition for missing-after-refresh."
    );
  });
});
