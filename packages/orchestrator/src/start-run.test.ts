import { describe, expect, it } from "vitest";
import { createTrialProfile } from "../../domain/src/index.js";
import { scenarioRegistry } from "../../registry/src/index.js";
import { createReplayLog, type CodexRunner, type OpenClawGateway } from "../../sandbox/src/index.js";
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
    expect(storedRun?.runAnalysis).toEqual({
      reportVersion: "v1",
      runId: "run-0001",
      scenarioId: storedRun?.scenario.scenarioId,
      generatedAt: expect.any(String),
      summary: expect.stringContaining("completed without classified failure patterns"),
      confidence: "medium",
      capabilityInsights: expect.any(Array),
      failurePatterns: [],
      suggestedChanges: [],
      evidenceAnchors: expect.any(Array),
      comparisonKeys: {
        failureClasses: [],
        affectedDimensions: [],
        suggestedChangeTypes: []
      }
    });
    expect(storedRun?.gradeAssessment).toEqual({
      assessmentVersion: "v1",
      runId: "run-0001",
      scenarioId: storedRun?.scenario.scenarioId,
      recommendedGrade: "Mid",
      gradeConfidence: "medium",
      authorizedScope: [
        {
          scopeId: "run-0001:authorized:mid",
          summary: "Mid scope covers routine production tasks with bounded autonomy.",
          allowedWork: [
            "Deliver routine production tasks within approved tool and risk bounds.",
            "Handle expected failures with documented recovery steps."
          ],
          blockedWork: ["Take on novel or high-blast-radius work without extra review."],
          evidenceAnchors: expect.any(Array)
        }
      ],
      restrictedScope: [],
      promotionGaps: [
        {
          gapId: "run-0001:gap:senior",
          title: "Raise average measured performance to senior bar",
          description:
            "Increase measured performance and consistency before expanding scope to Senior.",
          targetGrade: "Senior",
          evidenceAnchors: expect.any(Array)
        }
      ],
      blockingIssues: [],
      supportingEvidence: expect.any(Array)
    });
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
        kind: "provider-agent",
        provider: "openclaw",
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
    expect(storedRun?.runAnalysis.runId).toBe(run.runId);
    expect(storedRun?.gradeAssessment.runId).toBe(run.runId);
    expect(storedRun?.gradeAssessment.recommendedGrade).toBe("Mid");
  });

  it("creates a run through the provider-agent codex runtime target", async () => {
    const store = createInMemoryRunStore();
    const runner: CodexRunner = async ({ runId, scenario }) => ({
      events: [
        {
          type: "run.started",
          runId,
          scenarioId: scenario.scenarioId
        },
        {
          type: "agent.summary",
          text: "Codex completed the requested workflow."
        },
        {
          type: "run.completed",
          result: {
            scenarioId: scenario.scenarioId,
            scenarioType: scenario.type,
            outcome: "passed",
            summary: "Codex completed the requested workflow."
          }
        }
      ],
      replay: createReplayLog(runId, [
        {
          type: "run.started",
          runId,
          scenarioId: scenario.scenarioId
        },
        {
          type: "agent.summary",
          text: "Codex completed the requested workflow."
        },
        {
          type: "run.completed",
          result: {
            scenarioId: scenario.scenarioId,
            scenarioType: scenario.type,
            outcome: "passed",
            summary: "Codex completed the requested workflow."
          }
        }
      ])
    });

    const run = await startRun({
      store,
      profile: fixtureProfile(),
      registry: scenarioRegistry,
      runtime: {
        kind: "provider-agent",
        provider: "codex",
        agentId: "trial-agent",
        workspaceRoot: "/tmp/project",
        runner
      }
    });

    const storedRun = store.getRun(run.runId);
    expect(storedRun?.replay.events.map((event) => event.type)).toEqual([
      "run.started",
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
