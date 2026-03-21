import { describe, expect, it } from "vitest";
import { createTrialProfile } from "../../domain/src/index.js";
import { scenarioRegistry } from "../../registry/src/index.js";
import type { OpenClawGateway } from "../../sandbox/src/index.js";
import { createInMemoryRunStore } from "./run-store.js";
import { startRun } from "./start-run.js";
import { streamRun } from "./stream-run.js";

function fixtureProfile() {
  return createTrialProfile({
    agentVersion: "agent-v1",
    build: {
      robustness: "high",
      safetyDiscipline: "high"
    },
    scenarioRegistryVersion: scenarioRegistry.version,
    judgeConfigVersion: "judge-v1",
    seed: "seed-123"
  });
}

describe("startRun", () => {
  it("creates a run and exposes a deterministic event stream", async () => {
    const store = createInMemoryRunStore();

    const run = await startRun({
      store,
      profile: fixtureProfile(),
      registry: scenarioRegistry,
      runtime: {
        kind: "scripted",
        agentName: "cautiousPlanner"
      }
    });

    expect(run.runId).toBe("run-0001");
    expect(run.streamPath).toBe("/runs/run-0001/events");
    expect(run.replayPath).toBe("/runs/run-0001/replay");

    const streamedEvents = [];
    for await (const event of streamRun({
      store,
      runId: run.runId
    })) {
      streamedEvents.push(event);
    }

    expect(streamedEvents.map((event) => event.type)).toEqual([
      "run.started",
      "agent.summary",
      "tool.called",
      "judge.update",
      "run.completed"
    ]);

    const storedRun = store.getRun(run.runId);
    expect(storedRun?.scenario.scenarioId).toBeDefined();
    expect(storedRun?.replay.events).toEqual(streamedEvents);
    expect(storedRun?.admission.status).toBe("production-ready");
  });

  it("creates a run through the OpenClaw runtime target", async () => {
    const store = createInMemoryRunStore();
    const gateway: OpenClawGateway = {
      async createSession() {
        return {
          runId: "run-0001",
          sessionKey: "agent:agent-1:trial-arena:run-0001"
        };
      },
      async *subscribeSession() {
        yield { type: "status", summary: "OpenClaw run accepted: run-0001" };
        yield { type: "assistant_message", text: "OpenClaw started work." };
        yield {
          type: "session.completed",
          summary: "OpenClaw agent run completed."
        };
      },
      async closeSession() {
        // no-op
      }
    };

    const run = await startRun({
      store,
      profile: fixtureProfile(),
      registry: scenarioRegistry,
      runtime: {
        kind: "openclaw",
        agentId: "agent-1",
        workspaceRoot: "/tmp/openclaw-workspace",
        gateway
      }
    });

    const storedRun = store.getRun(run.runId);

    expect(storedRun?.replay.events.map((event) => event.type)).toEqual([
      "run.started",
      "judge.update",
      "agent.summary",
      "run.completed"
    ]);
    expect(storedRun?.admission.status).toBe("production-ready");
  });

  it("rejects requests for runs that were never stored", async () => {
    const store = createInMemoryRunStore();

    await expect(async () => {
      for await (const _event of streamRun({
        store,
        runId: "run-missing"
      })) {
        // exhaust generator
      }
    }).rejects.toThrow("Unknown run: run-missing");
  });
});
