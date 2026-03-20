import type { RunEvent, ScenarioResult } from "@openclaw/domain";
import type { OpenClawGatewayEvent } from "./gateway-client.js";

export interface MapGatewayEventInput {
  readonly event: OpenClawGatewayEvent;
  readonly scenarioId: string;
  readonly scenarioType: ScenarioResult["scenarioType"];
}

function createCompletedResult(
  input: MapGatewayEventInput,
  outcome: ScenarioResult["outcome"],
  summary: string
): ScenarioResult {
  return {
    scenarioId: input.scenarioId,
    scenarioType: input.scenarioType,
    outcome,
    summary
  };
}

export function mapGatewayEvent(input: MapGatewayEventInput): RunEvent[] {
  const { event } = input;

  if (event.type === "assistant_message" && typeof event.text === "string") {
    return [{ type: "agent.summary", text: event.text }];
  }

  if (event.type === "tool_call" && typeof event.toolName === "string") {
    return [{ type: "tool.called", toolName: event.toolName, input: event.input }];
  }

  if (event.type === "status" && typeof event.summary === "string") {
    return [{ type: "judge.update", summary: event.summary }];
  }

  if (event.type === "session.completed") {
    const outcome = event.outcome === "failed" ? "failed" : "passed";
    const summary =
      typeof event.summary === "string"
        ? event.summary
        : "OpenClaw session completed.";

    return [
      {
        type: "run.completed",
        result: createCompletedResult(input, outcome, summary)
      }
    ];
  }

  if (event.type === "session.error") {
    const summary =
      typeof event.summary === "string"
        ? event.summary
        : "OpenClaw session failed.";

    return [
      { type: "judge.update", summary },
      {
        type: "run.completed",
        result: createCompletedResult(input, "errored", summary)
      }
    ];
  }

  return [
    {
      type: "judge.update",
      summary: `Unhandled OpenClaw event: ${event.type}`
    }
  ];
}
