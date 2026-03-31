import type { TrialProfile } from "../../domain/src/builds.js";
import type { ScenarioResult } from "../../domain/src/scenarios.js";
import { analyzeRun, evaluateGrade, judgeScenario } from "../../judge/src/index.js";
import {
  selectScenarios,
  type ScenarioRegistry
} from "../../registry/src/index.js";
import {
  runScenarioWithOpenClawAgent,
  runScenarioWithScriptedAgent,
  type OpenClawGateway,
  type ScriptedAgentName
} from "../../sandbox/src/index.js";
import { finalizeRun } from "./finalize-run.js";
import type { RunStore } from "./run-store.js";

export type RunRuntimeTarget =
  | {
      readonly kind: "scripted";
      readonly agentName: ScriptedAgentName;
    }
  | {
      readonly kind: "openclaw";
      readonly agentId: string;
      readonly workspaceRoot: string;
      readonly gateway: OpenClawGateway;
    };

export interface StartRunInput {
  readonly store: RunStore;
  readonly profile: TrialProfile;
  readonly registry: ScenarioRegistry;
  readonly runtime: RunRuntimeTarget;
  readonly limit?: number;
}

export interface StartedRun {
  readonly runId: string;
  readonly streamPath: string;
  readonly replayPath: string;
}

export async function startRun(input: StartRunInput): Promise<StartedRun> {
  const [scenario] = selectScenarios({
    profile: input.profile,
    registry: input.registry,
    limit: input.limit ?? 1
  });

  if (!scenario) {
    throw new Error("No scenarios available for run");
  }

  const runId = input.store.nextRunId();
  const runnerOutput =
    input.runtime.kind === "scripted"
      ? await runScenarioWithScriptedAgent({
          runId,
          scenarioId: scenario.scenarioId,
          scenarioType: scenario.type,
          agentName: input.runtime.agentName
        })
      : await runScenarioWithOpenClawAgent({
          gateway: input.runtime.gateway,
          runId,
          scenario,
          agentId: input.runtime.agentId,
          workspaceRoot: input.runtime.workspaceRoot
        });
  const scenarioResult = readCompletedScenarioResult(runnerOutput.events);
  const judge = judgeScenario({
    scenario,
    events: runnerOutput.events,
    scenarioResult
  });
  const runAnalysis = analyzeRun({
    runId,
    scenario,
    events: runnerOutput.events,
    replay: runnerOutput.replay,
    judge,
    admission: judge.admission,
    measuredProfile: judge.measuredProfile
  });
  const gradeAssessment = evaluateGrade({
    runAnalysis,
    judge,
    measuredProfile: judge.measuredProfile
  });

  finalizeRun({
    store: input.store,
    runId,
    profile: input.profile,
    scenario,
    events: runnerOutput.events,
    replay: runnerOutput.replay,
    judge,
    runAnalysis,
    gradeAssessment
  });

  return {
    runId,
    streamPath: `/runs/${runId}/events`,
    replayPath: `/runs/${runId}/replay`
  };
}

function readCompletedScenarioResult(
  events: readonly import("../../domain/src/events.js").RunEvent[]
): ScenarioResult | undefined {
  const completedEvent = events.find((event) => event.type === "run.completed");
  return completedEvent?.type === "run.completed"
    ? structuredClone(completedEvent.result)
    : undefined;
}
