import { describe, expect, it } from "vitest";
import {
  createEvalArtifactExecutionPlan,
  runReplayEvalArtifact
} from "./replay-eval-runner.js";

describe("runReplayEvalArtifact", () => {
  it("maps an eval artifact into a trial execution plan", () => {
    const plan = createEvalArtifactExecutionPlan({
      artifactId: "artifact-0",
      artifactType: "replay",
      createdAt: "2026-04-09T01:00:00.000Z",
      sourceTraceId: "trace-0",
      sourceLearningRecordIds: ["learning-0"],
      regressionTags: ["recovery"],
      successPredicate: "Use rollout status before retrying.",
      safetyPredicate: "No new safety risk.",
      replayEvents: [{ type: "agent.summary", text: "Use rollout status before retrying." }]
    });

    expect(plan).toEqual({
      executionId: "eval-plan:artifact-0",
      artifactId: "artifact-0",
      runId: "trace-0",
      scenarioId: "production-feedback",
      scenarioType: "workflow",
      replayEvents: [{ type: "agent.summary", text: "Use rollout status before retrying." }]
    });
  });

  it("passes a replay artifact with replay events and a terminal event", () => {
    const result = runReplayEvalArtifact({
      executedAt: "2026-04-09T01:00:00.000Z",
      artifact: {
        artifactId: "artifact-1",
        artifactType: "replay",
        createdAt: "2026-04-09T01:00:00.000Z",
        sourceTraceId: "trace-1",
        sourceLearningRecordIds: ["learning-1"],
        regressionTags: ["recovery"],
        successPredicate: "Use rollout status before retrying.",
        safetyPredicate: "No new safety risk.",
        replayEvents: [
          { type: "agent.summary", text: "Use rollout status before retrying." },
          {
            type: "run.completed",
            result: {
              scenarioId: "production-feedback",
              scenarioType: "workflow",
              outcome: "passed",
              summary: "Recovered safely."
            }
          }
        ]
      }
    });

    expect(result).toEqual({
      executionId: "eval-exec:artifact-1:2026-04-09T01:00:00.000Z",
      artifactId: "artifact-1",
      executedAt: "2026-04-09T01:00:00.000Z",
      passed: true,
      summary: "Eval artifact artifact-1 passed replay-eval runner execution."
    });
  });

  it("fails a replay artifact without a terminal event", () => {
    const result = runReplayEvalArtifact({
      executedAt: "2026-04-09T01:01:00.000Z",
      artifact: {
        artifactId: "artifact-2",
        artifactType: "replay",
        createdAt: "2026-04-09T01:01:00.000Z",
        sourceTraceId: "trace-1",
        sourceLearningRecordIds: ["learning-1"],
        regressionTags: ["recovery"],
        successPredicate: "Use rollout status before retrying.",
        safetyPredicate: "No new safety risk.",
        replayEvents: [{ type: "agent.summary", text: "Use rollout status before retrying." }]
      }
    });

    expect(result.passed).toBe(false);
  });
});
