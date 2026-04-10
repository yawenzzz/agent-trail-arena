import { describe, expect, it } from "vitest";
import { runEvalArtifact } from "./eval-runner-adapter.js";

describe("runEvalArtifact", () => {
  it("passes a replay artifact with replay events and success predicate", () => {
    const result = runEvalArtifact({
      executedAt: "2026-04-09T00:00:00.000Z",
      artifact: {
        artifactId: "artifact-1",
        artifactType: "replay",
        createdAt: "2026-04-09T00:00:00.000Z",
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
      executionId: "eval-exec:artifact-1:2026-04-09T00:00:00.000Z",
      artifactId: "artifact-1",
      executedAt: "2026-04-09T00:00:00.000Z",
      passed: true,
      summary: "Eval artifact artifact-1 passed replay-eval runner execution."
    });
  });

  it("fails a replay artifact without replay events", () => {
    const result = runEvalArtifact({
      executedAt: "2026-04-09T00:01:00.000Z",
      artifact: {
        artifactId: "artifact-2",
        artifactType: "replay",
        createdAt: "2026-04-09T00:01:00.000Z",
        sourceTraceId: "trace-1",
        sourceLearningRecordIds: ["learning-1"],
        regressionTags: ["recovery"],
        successPredicate: "Use rollout status before retrying.",
        safetyPredicate: "No new safety risk.",
        replayEvents: []
      }
    });

    expect(result.passed).toBe(false);
  });
});
