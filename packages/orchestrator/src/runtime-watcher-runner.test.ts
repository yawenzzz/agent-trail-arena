import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createFileBackedCapabilityImprovementStoreSync } from "./file-backed-capability-store.js";
import {
  runCapabilityWatcherCycle,
  runCapabilityWatcherDaemon
} from "./runtime-watcher-runner.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeStateFilePath() {
  const dir = mkdtempSync(join(tmpdir(), "runtime-watcher-runner-"));
  tempDirs.push(dir);
  return join(dir, "capability-store.json");
}

describe("runtime watcher runner", () => {
  it("runs a one-shot watcher cycle from file-backed state", () => {
    const stateFilePath = makeStateFilePath();
    const store = createFileBackedCapabilityImprovementStoreSync({ stateFilePath });

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-09T00:00:00.000Z",
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
      createdAt: "2026-04-09T00:01:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-09T00:02:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-09T00:03:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-09T00:04:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });
    store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-09T00:05:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-09T00:06:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const result = runCapabilityWatcherCycle({
      stateFilePath,
      evaluatedAt: "2026-04-09T00:07:00.000Z",
      triggerRollback: false
    });

    expect(result).toEqual(
      expect.objectContaining({
        runtimeConfig: expect.objectContaining({
          bundleVersionId: "bundle-0002"
        }),
        evaluation: expect.objectContaining({
          shouldRollback: true
        })
      })
    );
  });

  it("runs a daemon-style watcher loop from file-backed state", async () => {
    const stateFilePath = makeStateFilePath();
    const store = createFileBackedCapabilityImprovementStoreSync({ stateFilePath });

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-09T00:10:00.000Z",
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
      createdAt: "2026-04-09T00:11:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-09T00:12:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-09T00:13:00.000Z"
    });
    store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-09T00:14:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: [],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });
    store.recordMetricSnapshot({
      bundleVersionId: "bundle-0001",
      capturedAt: "2026-04-09T00:15:00.000Z",
      totalRuns: 10,
      successfulRuns: 9,
      userCorrectionCount: 1,
      humanTakeoverCount: 0,
      interruptedRuns: 0,
      retryCount: 1,
      stuckRuns: 0
    });
    store.recordMetricSnapshot({
      bundleVersionId: "bundle-0002",
      capturedAt: "2026-04-09T00:16:00.000Z",
      totalRuns: 10,
      successfulRuns: 6,
      userCorrectionCount: 3,
      humanTakeoverCount: 1,
      interruptedRuns: 1,
      retryCount: 4,
      stuckRuns: 1
    });

    const loopResult = await runCapabilityWatcherDaemon({
      stateFilePath,
      tickCount: 2,
      intervalMs: 1,
      evaluatedAtSeed: "2026-04-09T00:17:00.000Z",
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
