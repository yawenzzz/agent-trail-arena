import { describe, expect, it, vi } from "vitest";
import { createOpenClawAgent } from "./agent-provisioner.js";
import type { ResolvedOpenClawWorkspace } from "./types.js";

function makeResolvedWorkspace(
  stateRoot: string,
  agents: ResolvedOpenClawWorkspace["agents"]
): ResolvedOpenClawWorkspace {
  return {
    stateRoot,
    configPath: `${stateRoot}/openclaw.json`,
    agents
  };
}

describe("createOpenClawAgent", () => {
  it("rejects duplicate names before invoking the CLI", async () => {
    const runCommand = vi.fn();
    const resolveWorkspace = vi.fn();

    await expect(
      createOpenClawAgent({
        stateRoot: "/tmp/openclaw-state",
        agentName: "prod-agent",
        existingAgents: [
          {
            agentId: "prod-agent",
            agentName: "prod-agent",
            definitionPath: "/tmp/openclaw-state/openclaw.json",
            workspaceRoot: "/tmp/openclaw-state/workspace-prod-agent"
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
        stateRoot: "/tmp/openclaw-state",
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
    const stateRoot = "/tmp/openclaw-state";
    const createdAgent = {
      agentId: "fresh-agent",
      agentName: "fresh-agent",
      definitionPath: `${stateRoot}/openclaw.json`,
      workspaceRoot: `${stateRoot}/workspace-fresh-agent`
    };
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce(makeResolvedWorkspace(stateRoot, []))
      .mockResolvedValueOnce(makeResolvedWorkspace(stateRoot, [createdAgent]));
    const runCommand = vi.fn().mockResolvedValue(undefined);

    const result = await createOpenClawAgent({
      stateRoot: `${stateRoot}/../openclaw-state`,
      agentName: "fresh-agent",
      runCommand,
      resolveWorkspace
    });

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith({
      args: [
        "agents",
        "add",
        "fresh-agent"
      ],
      env: {
        OPENCLAW_CONFIG_PATH: `${stateRoot}/openclaw.json`,
        OPENCLAW_STATE_DIR: stateRoot
      }
    });
    expect(resolveWorkspace).toHaveBeenCalledTimes(2);
    expect(resolveWorkspace).toHaveBeenNthCalledWith(1, {
      stateRoot,
      configPath: `${stateRoot}/openclaw.json`
    });
    expect(resolveWorkspace).toHaveBeenNthCalledWith(2, {
      stateRoot,
      configPath: `${stateRoot}/openclaw.json`
    });
    expect(result).toBe(createdAgent);
  });

  it("surfaces CLI failures with useful command context", async () => {
    const stateRoot = "/tmp/openclaw-state";
    const runCommand = vi
      .fn()
      .mockRejectedValue(new Error("OpenClaw command failed (openclaw agents add broken-agent): missing binary"));
    const resolveWorkspace = vi.fn().mockResolvedValue(makeResolvedWorkspace(stateRoot, []));

    await expect(
      createOpenClawAgent({
        stateRoot,
        agentName: "broken-agent",
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow("OpenClaw command failed (openclaw agents add broken-agent)");

    expect(resolveWorkspace).toHaveBeenCalledTimes(1);
  });

  it("fails when refreshed discovery does not contain the created agent", async () => {
    const stateRoot = "/tmp/openclaw-state";
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce(makeResolvedWorkspace(stateRoot, []))
      .mockResolvedValueOnce(
        makeResolvedWorkspace(stateRoot, [
          {
            agentId: "existing-agent",
            agentName: "existing-agent",
            definitionPath: `${stateRoot}/openclaw.json`,
            workspaceRoot: `${stateRoot}/workspace-existing-agent`
          }
        ])
      );
    const runCommand = vi.fn().mockResolvedValue(undefined);

    await expect(
      createOpenClawAgent({
        stateRoot,
        agentName: "missing-after-refresh",
        runCommand,
        resolveWorkspace
      })
    ).rejects.toThrow(
      "Agent creation did not produce a definition for missing-after-refresh."
    );
  });
});
