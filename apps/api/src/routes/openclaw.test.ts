import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../app.js";

describe("openclaw routes", () => {
  it("exposes unified agent resolve/provision routes for the OpenClaw provider", async () => {
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
      url: "/agents/resolve",
      payload: {
        provider: "openclaw",
        stateRoot: "/tmp/openclaw-state"
      }
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json()).toEqual(
      expect.objectContaining({
        provider: "openclaw",
        stateRoot: "/tmp/openclaw-state",
        configPath: "/tmp/openclaw-state/openclaw.json"
      })
    );

    const provisionResponse = await app.inject({
      method: "POST",
      url: "/agents/provision",
      payload: {
        provider: "openclaw",
        stateRoot: "/tmp/openclaw-state",
        agentName: "fresh-agent"
      }
    });

    expect(provisionResponse.statusCode).toBe(201);
    expect(provisionResponse.json()).toEqual({
      agent: {
        provider: "openclaw",
        agentId: "fresh-agent",
        agentName: "fresh-agent",
        definitionPath: "/tmp/openclaw-state/openclaw.json",
        workspaceRoot: "/tmp/openclaw-state/workspace-fresh-agent"
      }
    });

    await app.close();
  });

  it("exposes unified agent resolve/provision routes for the Codex provider", async () => {
    const resolveCodexWorkspace = vi.fn().mockReturnValue({
      provider: "codex",
      workspaceRoot: "/tmp/project",
      agents: [
        {
          provider: "codex",
          agentId: "trial-agent",
          agentName: "Trial Agent",
          workspaceRoot: "/tmp/project"
        }
      ]
    });
    const provisionCodexAgent = vi.fn().mockReturnValue({
      provider: "codex",
      agentId: "fresh-agent",
      agentName: "Fresh Agent",
      workspaceRoot: "/tmp/project"
    });

    const app = buildApp({
      resolveCodexWorkspace,
      provisionCodexAgent
    });

    const resolveResponse = await app.inject({
      method: "POST",
      url: "/agents/resolve",
      payload: {
        provider: "codex",
        workspaceRoot: "/tmp/project"
      }
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json()).toEqual({
      provider: "codex",
      workspaceRoot: "/tmp/project",
      agents: [
        {
          provider: "codex",
          agentId: "trial-agent",
          agentName: "Trial Agent",
          workspaceRoot: "/tmp/project"
        }
      ]
    });

    const provisionResponse = await app.inject({
      method: "POST",
      url: "/agents/provision",
      payload: {
        provider: "codex",
        workspaceRoot: "/tmp/project",
        agentName: "Fresh Agent"
      }
    });

    expect(provisionResponse.statusCode).toBe(201);
    expect(provisionResponse.json()).toEqual({
      agent: {
        provider: "codex",
        agentId: "fresh-agent",
        agentName: "Fresh Agent",
        workspaceRoot: "/tmp/project"
      }
    });

    await app.close();
  });

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

  it("applies the active serving bundle into the OpenClaw state root", async () => {
    const stateRoot = "/tmp/openclaw-state";
    const app = buildApp();

    const ingestResponse = await app.inject({
      method: "POST",
      url: "/production-runs",
      payload: {
        capturedAt: "2026-04-08T03:00:00.000Z",
        userRequest: "Recover safely after correction.",
        agentMessages: [],
        toolCalls: [],
        userCorrections: [
          {
            correctionId: "correction-1",
            summary: "Use rollout status before retrying."
          }
        ],
        signals: {
          retryCount: 1,
          interrupted: false,
          stuck: false,
          humanTakeover: false
        },
        terminalOutcome: {
          status: "failed",
          summary: "The agent retried before using rollout status."
        }
      }
    });
    expect(ingestResponse.statusCode).toBe(201);

    await app.inject({
      method: "POST",
      url: "/learning-records/learning-0001/synthesize-artifacts"
    });
    await app.inject({
      method: "POST",
      url: "/learning-records/learning-0001/candidates"
    });
    await app.inject({
      method: "POST",
      url: "/candidates/candidate-0001/validate"
    });
    await app.inject({
      method: "POST",
      url: "/candidates/candidate-0001/promote",
      payload: {
        promotedAt: "2026-04-08T03:01:00.000Z",
        bundle: {
          prompt: "Use rollout status before retrying.",
          memory: [],
          knowledge: ["Use rollout status before retrying the same command."]
        }
      }
    });

    const applyResponse = await app.inject({
      method: "POST",
      url: "/openclaw/serving-bundle/apply",
      payload: {
        stateRoot
      }
    });

    expect(applyResponse.statusCode).toBe(200);
    expect(applyResponse.json()).toEqual({
      applied: expect.objectContaining({
        stateRoot,
        runtimeConfig: {
          bundleVersionId: "bundle-0002",
          prompt: "Use rollout status before retrying.",
          memory: [],
          knowledge: ["Use rollout status before retrying the same command."]
        }
      })
    });

    const readAppliedResponse = await app.inject({
      method: "GET",
      url: "/openclaw/serving-bundle/applied",
      query: {
        stateRoot
      }
    });
    expect(readAppliedResponse.statusCode).toBe(200);
    expect(readAppliedResponse.json()).toEqual({
      applied: expect.objectContaining({
        stateRoot,
        runtimeConfig: {
          bundleVersionId: "bundle-0002",
          prompt: "Use rollout status before retrying.",
          memory: [],
          knowledge: ["Use rollout status before retrying the same command."]
        }
      })
    });

    const runtimeConfigResponse = await app.inject({
      method: "GET",
      url: "/openclaw/serving-bundle/runtime-config",
      query: {
        stateRoot
      }
    });
    expect(runtimeConfigResponse.statusCode).toBe(200);
    expect(runtimeConfigResponse.json()).toEqual({
      runtimeConfig: expect.objectContaining({
        bundleVersionId: "bundle-0002",
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."],
        applied: expect.objectContaining({
          stateRoot
        })
      })
    });

    await app.close();
  });
});
