import type {
  EvalArtifactExecutionPlan,
  EvalArtifactExecutionResult,
  EvalCaseArtifact
} from "@openclaw/domain";
import { createReplayLog } from "./replay-log.js";

export interface RunReplayEvalArtifactInput {
  readonly artifact: EvalCaseArtifact;
  readonly executedAt: string;
}

export function createEvalArtifactExecutionPlan(
  artifact: EvalCaseArtifact
): EvalArtifactExecutionPlan {
  return {
    executionId: `eval-plan:${artifact.artifactId}`,
    artifactId: artifact.artifactId,
    runId: artifact.sourceTraceId ?? artifact.artifactId,
    scenarioId: "production-feedback",
    scenarioType: "workflow",
    replayEvents: [...(artifact.replayEvents ?? [])]
  };
}

export function runReplayEvalArtifact(
  input: RunReplayEvalArtifactInput
): EvalArtifactExecutionResult {
  const executionPlan = createEvalArtifactExecutionPlan(input.artifact);
  const replayLog =
    input.artifact.artifactType === "replay" && Array.isArray(input.artifact.replayEvents)
      ? createReplayLog(executionPlan.runId, executionPlan.replayEvents)
      : undefined;
  const hasReplayEvents = replayLog ? replayLog.events.length > 0 : true;
  const hasCompletedEvent = replayLog
    ? replayLog.events.some((event) => event.type === "run.completed")
    : true;
  const passed =
    input.artifact.successPredicate.trim().length > 0 &&
    hasReplayEvents &&
    hasCompletedEvent;

  return {
    executionId: `eval-exec:${input.artifact.artifactId}:${input.executedAt}`,
    artifactId: input.artifact.artifactId,
    executedAt: input.executedAt,
    passed,
    summary: passed
      ? `Eval artifact ${input.artifact.artifactId} passed replay-eval runner execution.`
      : `Eval artifact ${input.artifact.artifactId} failed replay-eval runner execution.`
  };
}
