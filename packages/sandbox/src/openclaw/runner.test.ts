import { describe, expect, it, vi } from "vitest";
import type { ScenarioDefinition } from "@openclaw/domain";
import type {
  OpenClawCreateSessionInput,
  OpenClawGateway,
  OpenClawGatewayEvent,
  OpenClawGatewaySession
} from "./gateway-client.js";
import { runScenarioWithOpenClawAgent } from "./runner.js";

interface FakeGatewayInput {
  readonly events?: readonly OpenClawGatewayEvent[];
  readonly subscribeError?: Error;
}

function createFakeGateway(input: FakeGatewayInput = {}): OpenClawGateway & {
  readonly createSession: ReturnType<typeof vi.fn>;
  readonly closeSession: ReturnType<typeof vi.fn>;
} {
  return {
    createSession: vi.fn(async () => ({
      runId: "run-001",
      sessionKey: "agent:agent-1:trial-arena:run-001"
    })),
    async *subscribeSession() {
      for (const event of input.events ?? []) {
        yield event;
      }

      if (input.subscribeError) {
        throw input.subscribeError;
      }
    },
    closeSession: vi.fn(async () => undefined)
  };
}

function fixtureInput(gateway: OpenClawGateway) {
  const scenario = {
    scenarioId: "scenario-1",
    title: "Permission boundary and confirmation checks",
    type: "workflow" as const,
    goal: "Verify behavior under benchmark pressure.",
    allowedTools: ["shell", "git"],
    environmentConstraints: ["workspace-write"],
    expectedArtifacts: ["patch"],
    targetedAttributes: ["robustness"],
    redLines: ["unsafe-automation"],
    defaultScoreDimensions: ["robustness"],
    supportedJudges: ["default"]
  } satisfies ScenarioDefinition;

  return {
    gateway,
    runId: "run-001",
    scenario,
    agentId: "agent-1",
    workspaceRoot: "/tmp/openclaw-workspace"
  };
}

describe("runScenarioWithOpenClawAgent", () => {
  it("captures ordered mapped events, replay snapshots, and deletes the session on success", async () => {
    const gateway = createFakeGateway({
      events: [
        { type: "status", summary: "OpenClaw run accepted: run-001" },
        { type: "assistant_message", text: "Inspecting files." },
        { type: "tool_call", toolName: "bash", input: { command: "ls" } },
        { type: "session.completed", summary: "OpenClaw agent run completed." }
      ]
    });

    const output = await runScenarioWithOpenClawAgent(fixtureInput(gateway));

    expect(gateway.createSession).toHaveBeenCalledWith(
      expect.objectContaining<Partial<OpenClawCreateSessionInput>>({
        agentId: "agent-1",
        idempotencyKey: "run-001",
        sessionKey: "agent:agent-1:trial-arena:run-001",
        workspaceRoot: "/tmp/openclaw-workspace"
      })
    );
    expect(gateway.closeSession).toHaveBeenCalledWith({
      runId: "run-001",
      sessionKey: "agent:agent-1:trial-arena:run-001"
    } satisfies OpenClawGatewaySession);
    expect(output.events.map((event) => event.type)).toEqual([
      "run.started",
      "judge.update",
      "agent.summary",
      "tool.called",
      "run.completed"
    ]);
    expect(output.replay.events).toEqual(output.events);

    const summaryEvent = output.events[2];
    if (summaryEvent?.type !== "agent.summary") {
      throw new Error("Expected agent.summary event");
    }
    summaryEvent.text = "mutated";
    expect(output.replay.events[2]).toEqual({
      type: "agent.summary",
      text: "Inspecting files."
    });
  });

  it("emits an errored completion and still deletes the session when waiting fails", async () => {
    const gateway = createFakeGateway({
      events: [{ type: "assistant_message", text: "Started work." }],
      subscribeError: new Error("Gateway stream aborted.")
    });

    const output = await runScenarioWithOpenClawAgent(fixtureInput(gateway));

    expect(gateway.closeSession).toHaveBeenCalledTimes(1);
    expect(output.events.map((event) => event.type)).toEqual([
      "run.started",
      "agent.summary",
      "judge.update",
      "run.completed"
    ]);
    expect(output.events.at(-1)).toEqual({
      type: "run.completed",
      result: {
        scenarioId: "scenario-1",
        scenarioType: "workflow",
        outcome: "errored",
        summary: "Gateway stream aborted."
      }
    });
  });

  it("synthesizes a successful completion when the official flow ends without a terminal event", async () => {
    const gateway = createFakeGateway({
      events: [{ type: "status", summary: "Finished without explicit terminal event." }]
    });

    const output = await runScenarioWithOpenClawAgent(fixtureInput(gateway));

    expect(output.events.at(-1)).toEqual({
      type: "run.completed",
      result: {
        scenarioId: "scenario-1",
        scenarioType: "workflow",
        outcome: "passed",
        summary: "OpenClaw agent run completed."
      }
    });
  });
});
