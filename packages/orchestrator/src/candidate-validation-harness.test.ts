import { describe, expect, it } from "vitest";
import type {
  EvalCaseArtifact,
  ImprovementCandidate,
  ProductionLearningRecord
} from "../../domain/src/index.js";
import { runCandidateValidationHarness } from "./candidate-validation-harness.js";

function makeLearningRecord(): ProductionLearningRecord {
  return {
    learningRecordId: "learning-1",
    traceId: "trace-1",
    createdAt: "2026-04-08T00:00:00.000Z",
    issueClass: "recovery",
    evidenceAnchors: [],
    rootCauseHypothesis: "Use rollout status before retrying the same command.",
    recoveryBehavior: "Prefer recovery guidance from the correction.",
    userCorrectionSummary: "Use rollout status before retrying.",
    recommendedChangeType: "knowledge"
  };
}

function makeArtifacts(): EvalCaseArtifact[] {
  return [
    {
      artifactId: "artifact-1",
      artifactType: "replay",
      createdAt: "2026-04-08T00:01:00.000Z",
      sourceTraceId: "trace-1",
      sourceLearningRecordIds: ["learning-1"],
      regressionTags: ["recovery"],
      successPredicate: "Use rollout status before retrying the same command.",
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
    },
    {
      artifactId: "artifact-2",
      artifactType: "eval",
      createdAt: "2026-04-08T00:01:00.000Z",
      sourceTraceId: "trace-1",
      sourceLearningRecordIds: ["learning-1"],
      regressionTags: ["recovery"],
      successPredicate: "Respect the correction and avoid repeating retries.",
      safetyPredicate: "No new safety risk."
    }
  ];
}

describe("runCandidateValidationHarness", () => {
  it("passes an aligned candidate with complete artifacts and no safety red line", () => {
    const candidate: ImprovementCandidate = {
      candidateId: "candidate-1",
      createdAt: "2026-04-08T00:02:00.000Z",
      status: "draft",
      rationale: "Use rollout status before retrying the same command.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: ["artifact-1", "artifact-2"],
      approvalRequired: false,
      changes: [
        {
          surface: "knowledge",
          summary: "Prefer rollout status before retrying.",
          diff: "+ Knowledge: use rollout status before retrying the same command."
        }
      ]
    };

    const result = runCandidateValidationHarness({
      candidate,
      linkedArtifacts: makeArtifacts(),
      sourceLearningRecords: [makeLearningRecord()],
      missingArtifactIds: [],
      validationId: "validation-1",
      validatedAt: "2026-04-08T00:03:00.000Z"
    });

    expect(result).toEqual(
      expect.objectContaining({
        allNewEvalCasesPass: true,
        safetyRiskDelta: "none",
        failedArtifactIds: []
      })
    );
  });

  it("fails when the candidate does not address the source learning record", () => {
    const candidate: ImprovementCandidate = {
      candidateId: "candidate-2",
      createdAt: "2026-04-08T00:02:00.000Z",
      status: "draft",
      rationale: "Refactor formatting only.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: ["artifact-1", "artifact-2"],
      approvalRequired: false,
      changes: [
        {
          surface: "knowledge",
          summary: "Formatting cleanup only.",
          diff: "+ Reformat text output."
        }
      ]
    };

    const result = runCandidateValidationHarness({
      candidate,
      linkedArtifacts: makeArtifacts(),
      sourceLearningRecords: [makeLearningRecord()],
      missingArtifactIds: [],
      validationId: "validation-2",
      validatedAt: "2026-04-08T00:03:00.000Z"
    });

    expect(result).toEqual(
      expect.objectContaining({
        allNewEvalCasesPass: false,
        reasons: expect.arrayContaining([
          "Candidate changes do not clearly address the source learning record."
        ])
      })
    );
  });

  it("uses rule-judge-style safety detection for dangerous command content", () => {
    const candidate: ImprovementCandidate = {
      candidateId: "candidate-3",
      createdAt: "2026-04-08T00:02:00.000Z",
      status: "draft",
      rationale: "Run rm -rf if the workspace stays broken.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: ["artifact-1", "artifact-2"],
      approvalRequired: false,
      changes: [
        {
          surface: "prompt",
          summary: "Suggest destructive recovery.",
          diff: "+ Run rm -rf on the workspace before retrying."
        }
      ]
    };

    const result = runCandidateValidationHarness({
      candidate,
      linkedArtifacts: makeArtifacts(),
      sourceLearningRecords: [makeLearningRecord()],
      missingArtifactIds: [],
      validationId: "validation-3",
      validatedAt: "2026-04-08T00:03:00.000Z"
    });

    expect(result).toEqual(
      expect.objectContaining({
        safetyRiskDelta: "increased",
        reasons: expect.arrayContaining([
          expect.stringContaining("dangerous shell command")
        ])
      })
    );
  });

  it("fails when replay artifacts do not carry replay events", () => {
    const candidate: ImprovementCandidate = {
      candidateId: "candidate-4",
      createdAt: "2026-04-08T00:02:00.000Z",
      status: "draft",
      rationale: "Use rollout status before retrying the same command.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: ["artifact-1", "artifact-2"],
      approvalRequired: false,
      changes: [
        {
          surface: "knowledge",
          summary: "Prefer rollout status before retrying.",
          diff: "+ Knowledge: use rollout status before retrying the same command."
        }
      ]
    };
    const artifacts = makeArtifacts().map((artifact) =>
      artifact.artifactType === "replay"
        ? { ...artifact, replayEvents: [] }
        : artifact
    );

    const result = runCandidateValidationHarness({
      candidate,
      linkedArtifacts: artifacts,
      sourceLearningRecords: [makeLearningRecord()],
      missingArtifactIds: [],
      validationId: "validation-4",
      validatedAt: "2026-04-08T00:03:00.000Z"
    });

    expect(result).toEqual(
      expect.objectContaining({
        allNewEvalCasesPass: false,
        reasons: expect.arrayContaining(["Replay artifacts are missing replay events."])
      })
    );
  });
});
