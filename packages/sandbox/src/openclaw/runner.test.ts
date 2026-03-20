import { describe, expect, it, vi } from "vitest";
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
    createSession: vi.fn(async () => ({ sessionId: "session-1" })),
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
  return {
    gateway,
    runId: "run-001",
    scenarioId: "scenario-1",
    scenarioType: "workflow" as const,
    agentId: "agent-1",
    workspaceRoot: "/tmp/openclaw-workspace"
  };
}

describe("runScenarioWithOpenClawAgent", () => {
  it("captures ordered mapped events, replay snapshots, and closes the session on success", async () => {
    const gateway = createFakeGateway({
      events: [
        { type: "assistant_message", text: "Inspecting files." },
        { type: "tool_call", toolName: "bash", input: { command: "ls" } },
        { type: "status", summary: "Scoring intermediate result." },
        { type: "session.completed", summary: "OpenClaw session completed." }
      ]
    });

    const output = await runScenarioWithOpenClawAgent(fixtureInput(gateway));

    expect(gateway.createSession).toHaveBeenCalledWith({
      agentId: "agent-1",
      workspaceRoot: "/tmp/openclaw-workspace"
    });
    expect(gateway.closeSession).toHaveBeenCalledWith("session-1");
    expect(output.events.map((event) => event.type)).toEqual([
      "run.started",
      "agent.summary",
      "tool.called",
      "judge.update",
      "run.completed"
    ]);
    expect(output.replay.events).toEqual(output.events);

    const summaryEvent = output.events[1];
    if (summaryEvent?.type !== "agent.summary") {
      throw new Error("Expected agent.summary event");
    }
    summaryEvent.text = "mutated";
    expect(output.replay.events[1]).toEqual({
      type: "agent.summary",
      text: "Inspecting files."
    });
  });

  it("emits an errored completion and still closes the session when subscription fails", async () => {
    const gateway = createFakeGateway({
      events: [{ type: "assistant_message", text: "Started work." }],
      subscribeError: new Error("Gateway stream aborted.")
    });

    const output = await runScenarioWithOpenClawAgent(fixtureInput(gateway));

    expect(gateway.closeSession).toHaveBeenCalledWith("session-1");
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

  it("synthesizes a successful completion when the event stream ends without a terminal event", async () => {
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
        summary: "OpenClaw session completed."
      }
    });
  });
});
