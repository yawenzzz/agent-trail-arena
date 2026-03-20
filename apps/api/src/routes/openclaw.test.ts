import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

describe("openclaw routes", () => {
  it("resolves local agents from the OpenClaw state dir and provisions a missing agent", async () => {
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce({
        stateRoot: "/tmp/openclaw-state",
        configPath: "/tmp/openclaw-state/openclaw.json",
        agents: [
          {
            agentId: "existing-agent",
            agentName: "existing-agent",
            definitionPath: "/tmp/openclaw-state/openclaw.json",
            workspaceRoot: "/tmp/openclaw-state/workspace-existing-agent"
          }
        ]
      })
      .mockResolvedValueOnce({
        stateRoot: "/tmp/openclaw-state",
        configPath: "/tmp/openclaw-state/openclaw.json",
        agents: []
      });
    const provisionAgent = vi.fn().mockResolvedValue({
      agentId: "fresh-agent",
      agentName: "fresh-agent",
      definitionPath: "/tmp/openclaw-state/openclaw.json",
      workspaceRoot: "/tmp/openclaw-state/workspace-fresh-agent"
    });

    const app = buildApp({
      resolveOpenClawWorkspace: resolveWorkspace,
      provisionOpenClawAgent: provisionAgent
    });

    const resolveResponse = await app.inject({
      method: "POST",
      url: "/openclaw/resolve",
      payload: {
        stateRoot: "/tmp/openclaw-state"
      }
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().agents).toHaveLength(1);

    const provisionResponse = await app.inject({
      method: "POST",
      url: "/openclaw/provision",
      payload: {
        stateRoot: "/tmp/openclaw-state",
        agentName: "fresh-agent"
      }
    });

    expect(provisionResponse.statusCode).toBe(201);
    expect(provisionResponse.json()).toEqual({
      agent: {
        agentId: "fresh-agent",
        agentName: "fresh-agent",
        definitionPath: "/tmp/openclaw-state/openclaw.json",
        workspaceRoot: "/tmp/openclaw-state/workspace-fresh-agent"
      }
    });
    expect(provisionAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        stateRoot: "/tmp/openclaw-state",
        agentName: "fresh-agent",
        existingAgents: []
      })
    );

    await app.close();
  });

  it("returns a user-facing 400 when the state dir is invalid", async () => {
    const app = buildApp({
      resolveOpenClawWorkspace: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "OpenClaw state root does not exist or is not a directory: /tmp/openclaw-state"
          )
        )
    });

    const response = await app.inject({
      method: "POST",
      url: "/openclaw/resolve",
      payload: {
        stateRoot: "/tmp/openclaw-state"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "OpenClaw state root does not exist or is not a directory: /tmp/openclaw-state"
    });

    await app.close();
  });
});
