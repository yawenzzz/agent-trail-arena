import { describe, expect, it } from "vitest";
import { createInMemoryCapabilityImprovementStore } from "./capability-store.js";

describe("createInMemoryCapabilityImprovementStore", () => {
  it("versions serving bundles across promotion and rollback", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:00:30.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after a correction.",
      agentMessages: [],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Acknowledge the correction before retrying."
        }
      ],
      signals: {
        retryCount: 1,
        interrupted: false,
        stuck: false,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent retried without incorporating the correction."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:00:45.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:01:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-07T08:01:30.000Z"
    });

    const decision = store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-07T08:02:00.000Z",
      bundle: {
        prompt: "You are a helpful OpenClaw agent. When corrected, acknowledge and continue.",
        memory: [],
        knowledge: []
      }
    });

    expect(decision.outcome).toBe("promoted");
    expect(decision.previousActiveBundleVersionId).toBe("bundle-0001");
    expect(decision.promotedBundleVersionId).toBe("bundle-0002");
    expect(store.getActiveServingBundle()).toMatchObject({
      bundleVersionId: "bundle-0002",
      versionNumber: 2,
      parentBundleVersionId: "bundle-0001",
      previousActiveBundleVersionId: "bundle-0001",
      status: "active"
    });
    expect(store.getServingBundleVersion("bundle-0001")).toMatchObject({
      status: "superseded"
    });

    const rollback = store.rollbackActiveBundle({
      rolledBackAt: "2026-04-07T08:03:00.000Z",
      reason: "Post-promotion success rate regressed.",
      triggeredBy: "metric_guardrail"
    });

    expect(rollback).toEqual({
      rollbackEventId: "rollback-0001",
      rolledBackAt: "2026-04-07T08:03:00.000Z",
      reason: "Post-promotion success rate regressed.",
      triggeredBy: "metric_guardrail",
      restoredBundleVersionId: "bundle-0001",
      replacedBundleVersionId: "bundle-0002"
    });
    expect(store.getActiveServingBundle()).toMatchObject({
      bundleVersionId: "bundle-0001",
      status: "active"
    });
    expect(store.getServingBundleVersion("bundle-0002")).toMatchObject({
      status: "rolled-back"
    });
  });

  it("marks disallowed-surface candidates as approval-required and blocks auto-promotion", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const candidate = store.createCandidate({
      createdAt: "2026-04-07T08:04:00.000Z",
      rationale: "Attempt to broaden shell permissions.",
      linkedLearningRecordIds: ["learning-0002"],
      linkedEvalArtifactIds: [],
      changes: [
        {
          surface: "tool_permissions",
          summary: "Allow unrestricted shell.exec.",
          diff: "+ shell.exec:*"
        }
      ]
    });

    const decision = store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-07T08:05:00.000Z",
      bundle: {
        prompt: "Unsafe prompt",
        memory: [],
        knowledge: []
      }
    });

    expect(candidate.approvalRequired).toBe(true);
    expect(decision).toEqual({
      decisionId: "promotion-0001",
      candidateId: candidate.candidateId,
      decidedAt: "2026-04-07T08:05:00.000Z",
      outcome: "approval-required",
      reasons: ["Candidate touches approval-required surfaces."],
      activeBundleVersionId: "bundle-0001",
      previousActiveBundleVersionId: "bundle-0001"
    });
    expect(store.getActiveServingBundle()?.bundleVersionId).toBe("bundle-0001");
  });

  it("normalizes ingested production traces into replayable events and learning records", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:10:00.000Z",
      bundleVersionId: "bundle-0002",
      userRequest: "Fix the flaky CI workflow and explain what changed.",
      agentMessages: [
        {
          messageId: "assistant-1",
          text: "I am checking the failing workflow now."
        }
      ],
      toolCalls: [
        {
          callId: "tool-1",
          toolName: "shell.exec",
          input: { cmd: "pnpm test" },
          outputSummary: "1 test failed",
          status: "failed"
        }
      ],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Use the GitHub Action logs instead of rerunning the entire suite."
        }
      ],
      signals: {
        retryCount: 2,
        interrupted: false,
        stuck: true,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent retried the wrong command and never inspected the CI logs."
      }
    });

    expect(ingestion.trace.traceId).toBe("trace-0001");
    expect(ingestion.trace.replayEvents.map((event) => event.type)).toEqual([
      "run.started",
      "judge.update",
      "agent.summary",
      "tool.called",
      "judge.update",
      "judge.update",
      "judge.update",
      "run.completed"
    ]);
    expect(ingestion.trace.evidenceAnchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "trace-0001:event:1",
          summary: "Judge update: User request: Fix the flaky CI workflow and explain what changed."
        }),
        expect.objectContaining({
          anchorId: "trace-0001:event:3",
          eventType: "tool.called",
          summary: "Tool shell.exec called with command: pnpm test."
        })
      ])
    );
    expect(ingestion.learningRecords).toEqual([
      expect.objectContaining({
        learningRecordId: "learning-0001",
        traceId: "trace-0001",
        issueClass: "recovery",
        recommendedChangeType: "knowledge",
        userCorrectionSummary:
          "Use the GitHub Action logs instead of rerunning the entire suite."
      })
    ]);
    expect(store.getProductionTrace("trace-0001")).toMatchObject({
      bundleVersionId: "bundle-0002"
    });
    expect(store.listLearningRecords()).toHaveLength(1);
  });

  it("synthesizes replay/eval artifacts and generates a candidate from a learning record", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:20:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover the stuck deployment safely.",
      agentMessages: [
        {
          messageId: "assistant-1",
          text: "I will inspect the rollout state."
        }
      ],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Use rollout status before retrying the same command."
        }
      ],
      signals: {
        retryCount: 1,
        interrupted: false,
        stuck: true,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent retried instead of checking rollout status."
      }
    });

    const artifacts = store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:21:00.000Z"
    });

    expect(artifacts).toEqual([
      expect.objectContaining({
        artifactId: "artifact-0001",
        artifactType: "replay"
      }),
      expect.objectContaining({
        artifactId: "artifact-0002",
        artifactType: "eval"
      })
    ]);
    expect(store.listEvalArtifacts()).toHaveLength(2);

    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:22:00.000Z"
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        candidateId: "candidate-0001",
        linkedLearningRecordIds: [ingestion.learningRecords[0]!.learningRecordId],
        linkedEvalArtifactIds: ["artifact-0001", "artifact-0002"],
        approvalRequired: false
      })
    );
    expect(candidate.changes[0]).toMatchObject({
      surface: "knowledge"
    });
  });

  it("executes an eval artifact and stores the execution result", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:24:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover the stuck deployment safely.",
      agentMessages: [
        {
          messageId: "assistant-1",
          text: "I will inspect the rollout state."
        }
      ],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Use rollout status before retrying the same command."
        }
      ],
      signals: {
        retryCount: 1,
        interrupted: false,
        stuck: true,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent retried instead of checking rollout status."
      }
    });

    const artifacts = store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:25:00.000Z"
    });
    const execution = store.executeEvalArtifact({
      artifactId: artifacts[0]!.artifactId,
      executedAt: "2026-04-07T08:26:00.000Z"
    });

    expect(execution).toEqual(
      expect.objectContaining({
        artifactId: "artifact-0001",
        passed: true
      })
    );
    expect(store.listEvalExecutionResults()).toEqual([
      expect.objectContaining({
        artifactId: "artifact-0001"
      })
    ]);
  });

  it("stores validation results and blocks promotion before validation passes", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const candidate = store.createCandidate({
      createdAt: "2026-04-07T08:30:00.000Z",
      rationale: "Improve prompt guidance.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: [],
      changes: [
        {
          surface: "prompt",
          summary: "Improve prompt guidance.",
          diff: "+ Prefer rollout status before retries."
        }
      ]
    });

    const rejectedPromotion = store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-07T08:31:00.000Z",
      bundle: {
        prompt: "Updated prompt",
        memory: [],
        knowledge: []
      }
    });
    expect(rejectedPromotion).toEqual(
      expect.objectContaining({
        outcome: "rejected",
        reasons: ["Candidate has not passed validation gates."]
      })
    );

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:32:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely.",
      agentMessages: [],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Use rollout status before retrying."
        }
      ],
      signals: {
        retryCount: 1,
        interrupted: false,
        stuck: false,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The run retried before checking rollout status."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:33:00.000Z"
    });
    const generatedCandidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:34:00.000Z"
    });
    const validation = store.validateCandidate({
      candidateId: generatedCandidate.candidateId,
      validatedAt: "2026-04-07T08:35:00.000Z"
    });

    expect(validation).toEqual(
      expect.objectContaining({
        candidateId: generatedCandidate.candidateId,
        allNewEvalCasesPass: true,
        safetyRiskDelta: "none"
      })
    );
    expect(store.listValidationResults()).toHaveLength(1);
  });

  it("marks validation as increased risk when candidate content contains dangerous commands", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const candidate = store.createCandidate({
      createdAt: "2026-04-07T08:50:00.000Z",
      rationale: "Dangerous cleanup shortcut.",
      linkedLearningRecordIds: ["learning-unsafe"],
      linkedEvalArtifactIds: ["artifact-unsafe"],
      changes: [
        {
          surface: "prompt",
          summary: "Suggest destructive cleanup.",
          diff: "+ Run rm -rf on the failing workspace if retries continue."
        }
      ]
    });

    const validation = store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-07T08:51:00.000Z"
    });

    expect(validation).toEqual(
      expect.objectContaining({
        safetyRiskDelta: "increased",
        allNewEvalCasesPass: false,
        reasons: expect.arrayContaining([
          "Missing linked eval artifacts.",
          "Candidate changes do not clearly address the source learning record.",
          expect.stringContaining("dangerous shell command")
        ])
      })
    );
  });

  it("records metric snapshots, compares them, and triggers guardrail rollback on regression", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-07T08:40:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after correction.",
      agentMessages: [],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Acknowledge correction before retrying."
        }
      ],
      signals: {
        retryCount: 1,
        interrupted: false,
        stuck: false,
        humanTakeover: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent retried without using the correction."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:41:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-07T08:42:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-07T08:43:00.000Z"
    });
    const promotion = store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-07T08:44:00.000Z",
      bundle: {
        prompt: "Updated prompt",
        memory: [],
        knowledge: ["Use the correction before retrying."]
      }
    });

    const baseline = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-07T08:45:00.000Z",
      totalRuns: 10,
      successfulRuns: 8,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    const observed = store.recordMetricSnapshot({
      bundleVersionId: promotion.promotedBundleVersionId!,
      capturedAt: "2026-04-07T08:46:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const comparison = store.compareMetricSnapshots({
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId,
      comparedAt: "2026-04-07T08:47:00.000Z"
    });
    expect(comparison).toEqual(
      expect.objectContaining({
        successRateDelta: -0.2,
        userCorrectionRateDelta: 0.2,
        retryPerRunDelta: 0.3
      })
    );

    const evaluation = store.evaluateRollbackGuardrails({
      activeBundleVersionId: promotion.promotedBundleVersionId!,
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId,
      evaluatedAt: "2026-04-07T08:48:00.000Z",
      triggerRollback: true
    });
    expect(evaluation).toEqual(
      expect.objectContaining({
        shouldRollback: true,
        regressions: expect.arrayContaining([
          "success_rate_down",
          "user_correction_rate_up",
          "retry_per_run_up"
        ]),
        triggeredRollbackEventId: "rollback-0001"
      })
    );
    expect(store.listMetricSnapshots()).toHaveLength(2);
    expect(store.listGuardrailEvaluations()).toHaveLength(1);
    expect(store.getActiveServingBundle()).toMatchObject({
      bundleVersionId: "bundle-0001",
      status: "active"
    });
  });
});
