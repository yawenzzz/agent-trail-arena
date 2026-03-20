import { describe, expect, it } from "vitest";
import { mapGatewayEvent } from "./event-mapper.js";

const scenarioContext = {
  scenarioId: "scenario-1",
  scenarioType: "workflow" as const
};

describe("mapGatewayEvent", () => {
  it("maps assistant messages into agent summaries", () => {
    expect(
      mapGatewayEvent({
        ...scenarioContext,
        event: {
          type: "assistant_message",
          text: "Planning next step."
        }
      })
    ).toEqual([{ type: "agent.summary", text: "Planning next step." }]);
  });

  it("maps tool activity into tool.called events", () => {
    expect(
      mapGatewayEvent({
        ...scenarioContext,
        event: {
          type: "tool_call",
          toolName: "bash",
          input: { command: "pwd" }
        }
      })
    ).toEqual([
      {
        type: "tool.called",
        toolName: "bash",
        input: { command: "pwd" }
      }
    ]);
  });

  it("maps session errors into judge updates and errored completions", () => {
    expect(
      mapGatewayEvent({
        ...scenarioContext,
        event: {
          type: "session.error",
          summary: "Gateway refused the command."
        }
      })
    ).toEqual([
      {
        type: "judge.update",
        summary: "Gateway refused the command."
      },
      {
        type: "run.completed",
        result: {
          scenarioId: "scenario-1",
          scenarioType: "workflow",
          outcome: "errored",
          summary: "Gateway refused the command."
        }
      }
    ]);
  });

  it("maps unknown events into judge updates", () => {
    expect(
      mapGatewayEvent({
        ...scenarioContext,
        event: {
          type: "custom.event"
        }
      })
    ).toEqual([
      {
        type: "judge.update",
        summary: "Unhandled OpenClaw event: custom.event"
      }
    ]);
  });
});
