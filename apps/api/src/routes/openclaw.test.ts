import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

describe("openclaw routes", () => {
  it("resolves a workspace and provisions a missing agent", async () => {
    const resolveWorkspace = vi
      .fn()
      .mockResolvedValueOnce({
        workspaceRoot: "/tmp/openclaw-workspace",
        openclawRoot: "/tmp/openclaw-workspace/.openclaw",
        agents: [
          {
            agentId: "agent-1",
            agentName: "existing-agent",
            definitionPath: "/tmp/openclaw-workspace/.openclaw/agents/existing-agent.json",
            workspaceRoot: "/tmp/openclaw-workspace"
          }
        ]
      })
      .mockResolvedValueOnce({
        workspaceRoot: "/tmp/openclaw-workspace",
        openclawRoot: "/tmp/openclaw-workspace/.openclaw",
        agents: []
      });
    const provisionAgent = vi.fn().mockResolvedValue({
      agentId: "agent-2",
      agentName: "fresh-agent",
      definitionPath: "/tmp/openclaw-workspace/.openclaw/agents/fresh-agent.json",
      workspaceRoot: "/tmp/openclaw-workspace"
    });

    const app = buildApp({
      resolveOpenClawWorkspace: resolveWorkspace,
      provisionOpenClawAgent: provisionAgent
    });

    const resolveResponse = await app.inject({
      method: "POST",
      url: "/openclaw/resolve",
      payload: {
        workspaceRoot: "/tmp/openclaw-workspace"
      }
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().agents).toHaveLength(1);

    const provisionResponse = await app.inject({
      method: "POST",
      url: "/openclaw/provision",
      payload: {
        workspaceRoot: "/tmp/openclaw-workspace",
        agentName: "fresh-agent"
      }
    });

    expect(provisionResponse.statusCode).toBe(201);
    expect(provisionResponse.json()).toEqual({
      agent: {
        agentId: "agent-2",
        agentName: "fresh-agent",
        definitionPath: "/tmp/openclaw-workspace/.openclaw/agents/fresh-agent.json",
        workspaceRoot: "/tmp/openclaw-workspace"
      }
    });
    expect(provisionAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: "/tmp/openclaw-workspace",
        agentName: "fresh-agent",
        existingAgents: []
      })
    );

    await app.close();
  });

  it("returns a user-facing 400 when the workspace path is invalid", async () => {
    const app = buildApp({
      resolveOpenClawWorkspace: vi
        .fn()
        .mockRejectedValue(
          new Error(
            "Missing .openclaw directory under workspace root: /tmp/openclaw-workspace"
          )
        )
    });

    const response = await app.inject({
      method: "POST",
      url: "/openclaw/resolve",
      payload: {
        workspaceRoot: "/tmp/openclaw-workspace"
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      message: "Missing .openclaw directory under workspace root: /tmp/openclaw-workspace"
    });

    await app.close();
  });
});
