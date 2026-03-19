import type { ScenarioResult, RunEvent } from "@openclaw/domain";
import { createReplayLog, type ReplayLog } from "./replay-log.js";
import {
  materializeScript,
  type ScriptedAgentName
} from "./scripted-agent.js";

export interface RunnerInput {
  readonly runId: string;
  readonly scenarioId: string;
  readonly scenarioType: ScenarioResult["scenarioType"];
  readonly agentName: ScriptedAgentName;
}

export interface RunnerOutput {
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
}

function createCompletedResult(
  scenarioId: string,
  scenarioType: ScenarioResult["scenarioType"]
): ScenarioResult {
  return {
    scenarioId,
    scenarioType,
    outcome: "passed",
    summary: "Deterministic scripted sandbox run completed."
  };
}

export async function* streamScenarioWithScriptedAgent(
  input: RunnerInput
): AsyncGenerator<RunEvent> {
  yield {
    type: "run.started",
    runId: input.runId,
    scenarioId: input.scenarioId
  };

  const scriptedEvents = materializeScript(input.agentName);
  for (const event of scriptedEvents) {
    yield event;
  }

  yield {
    type: "run.completed",
    result: createCompletedResult(input.scenarioId, input.scenarioType)
  };
}

export async function runScenarioWithScriptedAgent(
  input: RunnerInput
): Promise<RunnerOutput> {
  const events: RunEvent[] = [];

  for await (const event of streamScenarioWithScriptedAgent(input)) {
    events.push(event);
  }

  return {
    events,
    replay: createReplayLog(input.runId, events)
  };
}
