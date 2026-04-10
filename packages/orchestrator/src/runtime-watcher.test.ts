import { describe, expect, it } from "vitest";
import { createInMemoryCapabilityImprovementStore } from "./capability-store.js";
import {
  runRuntimeWatcher,
  runRuntimeWatcherLoop,
  runRuntimeWatcherOnLatestSnapshots,
  selectLatestRuntimeWatcherSnapshotPair,
  watchRuntimeGuardrails
} from "./runtime-watcher.js";

describe("runtime watcher", () => {
  it("reads active runtime config and evaluates rollback guardrails", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T02:00:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after correction.",
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
        summary: "The agent retried before using rollout status."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:01:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:02:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T02:03:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-08T02:04:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });

    const baseline = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-08T02:05:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    const observed = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-08T02:06:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const watcherResult = runRuntimeWatcher({
      store,
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId,
      evaluatedAt: "2026-04-08T02:07:00.000Z",
      triggerRollback: false
    });

    expect(watcherResult.runtimeConfig).toEqual({
      bundleVersionId: "bundle-0002",
      prompt: "Use rollout status before retrying.",
      memory: [],
      knowledge: ["Use rollout status before retrying the same command."]
    });
    expect(watcherResult.evaluation).toEqual(
      expect.objectContaining({
        shouldRollback: true,
        regressions: expect.arrayContaining(["success_rate_down", "retry_per_run_up"])
      })
    );
  });

  it("can run a simple watcher loop and trigger rollback on the final tick", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T02:10:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after correction.",
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
        summary: "The agent retried before using rollout status."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:11:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:12:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T02:13:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-08T02:14:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });

    const baseline = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-08T02:15:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    const observed = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-08T02:16:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const loopResult = runRuntimeWatcherLoop({
      store,
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId,
      tickCount: 3,
      evaluatedAtSeed: "2026-04-08T02:17:00.000Z",
      triggerRollbackOnFinalTick: true
    });

    expect(loopResult.ticks).toHaveLength(3);
    expect(loopResult.ticks[2]?.evaluation).toEqual(
      expect.objectContaining({
        shouldRollback: true,
        triggeredRollbackEventId: "rollback-0001"
      })
    );
    expect(store.listRollbackEvents()).toHaveLength(1);
    expect(store.getActiveServingBundle()).toMatchObject({
      bundleVersionId: "bundle-0001",
      status: "active"
    });
  });

  it("can resolve the latest baseline/observed snapshot pair for the active bundle", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T02:20:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after correction.",
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
        summary: "The agent retried before using rollout status."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:21:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:22:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T02:23:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-08T02:24:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });

    const baseline = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-08T02:25:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    const observed = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-08T02:26:00.000Z",
      totalRuns: 10,
      successfulRuns: 7,
      userCorrectionCount: 2,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 2,
      stuckRuns: 0
    });

    const pair = selectLatestRuntimeWatcherSnapshotPair(store);
    expect(pair).toEqual({
      activeBundleVersionId: "bundle-0002",
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId
    });

    const latestResult = runRuntimeWatcherOnLatestSnapshots({
      store,
      evaluatedAt: "2026-04-08T02:27:00.000Z",
      triggerRollback: false
    });
    expect(latestResult.evaluation).toEqual(
      expect.objectContaining({
        shouldRollback: true
      })
    );
  });

  it("can drive a daemon-style async watch loop", async () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T02:30:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover safely after correction.",
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
        summary: "The agent retried before using rollout status."
      }
    });
    store.synthesizeEvalArtifactsFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:31:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T02:32:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T02:33:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-08T02:34:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });
    const baseline = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-08T02:35:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    const observed = store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-08T02:36:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const loopResult = await watchRuntimeGuardrails({
      store,
      baselineSnapshotId: baseline.snapshotId,
      observedSnapshotId: observed.snapshotId,
      tickCount: 2,
      intervalMs: 1,
      evaluatedAtSeed: "2026-04-08T02:37:00.000Z",
      triggerRollbackOnFinalTick: true,
      sleep: async () => {}
    });

    expect(loopResult.ticks).toHaveLength(2);
    expect(loopResult.ticks[1]?.evaluation).toEqual(
      expect.objectContaining({
        shouldRollback: true,
        triggeredRollbackEventId: "rollback-0001"
      })
    );
  });
});
