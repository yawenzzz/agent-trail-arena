import { describe, expect, it } from "vitest";
import type { OpenClawGateway } from "../../../../packages/sandbox/src/index.js";
import { buildApp } from "../app.js";

describe("run routes", () => {
  it("creates a run and exposes stream, replay, and summary endpoints", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/runs",
      payload: {
        agentVersion: "agent-v1",
        build: {
          robustness: "high",
          safetyDiscipline: "high"
        },
        judgeConfigVersion: "judge-v1",
        seed: "seed-123",
        agentName: "cautiousPlanner"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const createdRun = createResponse.json();
    expect(createdRun.runId).toBe("run-0001");
    expect(createdRun.streamPath).toBe("/runs/run-0001/events");
    expect(createdRun.replayPath).toBe("/runs/run-0001/replay");

    const eventResponse = await app.inject({
      method: "GET",
      url: createdRun.streamPath
    });

    expect(eventResponse.statusCode).toBe(200);
    expect(eventResponse.headers["content-type"]).toContain("text/event-stream");
    expect(eventResponse.body).toContain("event: run.started");
    expect(eventResponse.body).toContain("event: run.completed");

    const replayResponse = await app.inject({
      method: "GET",
      url: createdRun.replayPath
    });

    expect(replayResponse.statusCode).toBe(200);

    const replay = replayResponse.json();
    expect(replay.runId).toBe("run-0001");
    expect(replay.events).toHaveLength(5);

    const runResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdRun.runId}`
    });

    expect(runResponse.statusCode).toBe(200);

    const run = runResponse.json();
    expect(run.runId).toBe("run-0001");
    expect(run.scenario.scenarioId).toBeDefined();
    expect(run.admission.status).toBe("production-ready");
    expect(run).not.toHaveProperty("runAnalysis");
    expect(run).not.toHaveProperty("gradeAssessment");

    await app.close();
  });

  it("returns 404 for unknown runs", async () => {
    const app = buildApp();

    const replayResponse = await app.inject({
      method: "GET",
      url: "/runs/run-missing/replay"
    });
    const eventResponse = await app.inject({
      method: "GET",
      url: "/runs/run-missing/events"
    });
    const runResponse = await app.inject({
      method: "GET",
      url: "/runs/run-missing"
    });

    expect(replayResponse.statusCode).toBe(404);
    expect(eventResponse.statusCode).toBe(404);
    expect(runResponse.statusCode).toBe(404);

    await app.close();
  });

  it("creates a run through the OpenClaw runtime payload", async () => {
    const gateway: OpenClawGateway = {
      async createSession() {
        return {
          runId: "run-0001",
          sessionKey: "agent:agent-1:trial-arena:run-0001"
        };
      },
      async *subscribeSession() {
        yield { type: "status", summary: "OpenClaw run accepted: run-0001" };
        yield { type: "assistant_message", text: "Gateway agent responded." };
        yield {
          type: "session.completed",
          summary: "OpenClaw agent run completed."
        };
      },
      async closeSession() {
        // no-op
      }
    };
    const app = buildApp({
      createOpenClawGateway: () => gateway
    });

    const createResponse = await app.inject({
      method: "POST",
      url: "/runs",
      payload: {
        agentVersion: "agent-v1",
        build: {
          robustness: "high",
          safetyDiscipline: "high"
        },
        judgeConfigVersion: "judge-v1",
        seed: "seed-123",
        runtime: {
          kind: "openclaw",
          workspaceRoot: "/tmp/openclaw-workspace",
          agentId: "agent-1"
        }
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().runId).toBe("run-0001");

    const runResponse = await app.inject({
      method: "GET",
      url: "/runs/run-0001"
    });

    expect(runResponse.statusCode).toBe(200);
    expect(runResponse.json().replay.events.map((event: { type: string }) => event.type)).toEqual([
      "run.started",
      "judge.update",
      "agent.summary",
      "run.completed"
    ]);

    await app.close();
  });
});
