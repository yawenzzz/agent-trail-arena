import type { ScenarioResult, RunEvent } from "@openclaw/domain";
import { createReplayLog, type ReplayLog } from "./replay-log.js";
import {
  materializeScript,
  type ScriptedAgentName
} from "./scripted-agent.js";

export interface RunnerInput {
  readonly runId: string;
  readonly scenarioId: string;
  readonly agentName: ScriptedAgentName;
}

export interface RunnerOutput {
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
}

function createCompletedResult(scenarioId: string): ScenarioResult {
  return {
    scenarioId,
    scenarioType: "workflow",
    outcome: "passed",
    summary: "Deterministic scripted sandbox run completed."
  };
}

export async function runScenarioWithScriptedAgent(
  input: RunnerInput
): Promise<RunnerOutput> {
  const scriptedEvents = materializeScript(input.agentName);
  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: input.runId,
      scenarioId: input.scenarioId
    },
    ...scriptedEvents,
    {
      type: "run.completed",
      result: createCompletedResult(input.scenarioId)
    }
  ];

  return {
    events,
    replay: createReplayLog(input.runId, events)
  };
}
