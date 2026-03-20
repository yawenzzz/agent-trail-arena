import type { RunEvent, ScenarioResult } from "@openclaw/domain";
import { createReplayLog, type ReplayLog } from "../replay-log.js";
import type { OpenClawGateway } from "./gateway-client.js";
import { mapGatewayEvent } from "./event-mapper.js";

export interface OpenClawRunnerInput {
  readonly gateway: OpenClawGateway;
  readonly runId: string;
  readonly scenarioId: string;
  readonly scenarioType: ScenarioResult["scenarioType"];
  readonly agentId: string;
  readonly workspaceRoot?: string;
}

export interface OpenClawRunnerOutput {
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
}

function createErroredResult(
  input: OpenClawRunnerInput,
  summary: string
): ScenarioResult {
  return {
    scenarioId: input.scenarioId,
    scenarioType: input.scenarioType,
    outcome: "errored",
    summary
  };
}

function hasCompletedEvent(events: readonly RunEvent[]): boolean {
  return events.some((event) => event.type === "run.completed");
}

export async function runScenarioWithOpenClawAgent(
  input: OpenClawRunnerInput
): Promise<OpenClawRunnerOutput> {
  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: input.runId,
      scenarioId: input.scenarioId
    }
  ];

  let sessionId: string | undefined;

  try {
    const session = await input.gateway.createSession({
      agentId: input.agentId,
      workspaceRoot: input.workspaceRoot
    });
    sessionId = session.sessionId;

    for await (const rawEvent of input.gateway.subscribeSession(sessionId)) {
      events.push(
        ...mapGatewayEvent({
          event: rawEvent,
          scenarioId: input.scenarioId,
          scenarioType: input.scenarioType
        })
      );
    }

    if (!hasCompletedEvent(events)) {
      events.push({
        type: "run.completed",
        result: {
          scenarioId: input.scenarioId,
          scenarioType: input.scenarioType,
          outcome: "passed",
          summary: "OpenClaw session completed."
        }
      });
    }
  } catch (error) {
    const summary =
      error instanceof Error ? error.message : "OpenClaw session failed.";

    events.push({
      type: "judge.update",
      summary
    });

    if (!hasCompletedEvent(events)) {
      events.push({
        type: "run.completed",
        result: createErroredResult(input, summary)
      });
    }
  } finally {
    if (sessionId) {
      try {
        await input.gateway.closeSession(sessionId);
      } catch (error) {
        if (!hasCompletedEvent(events)) {
          const summary =
            error instanceof Error
              ? `OpenClaw session close failed: ${error.message}`
              : "OpenClaw session close failed.";

          events.push({
            type: "judge.update",
            summary
          });
          events.push({
            type: "run.completed",
            result: createErroredResult(input, summary)
          });
        }
      }
    }
  }

  return {
    events,
    replay: createReplayLog(input.runId, events)
  };
}
