import { mkdtempSync } from "node:fs";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createFileBackedCapabilityImprovementStore } from "./file-backed-capability-store.js";

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
  const dir = mkdtempSync(join(tmpdir(), "capability-store-"));
  tempDirs.push(dir);
  return join(dir, "state.json");
}

describe("createFileBackedCapabilityImprovementStore", () => {
  it("persists and restores capability-improvement state to disk", async () => {
    const stateFilePath = makeStateFilePath();
    const store = await createFileBackedCapabilityImprovementStore({ stateFilePath });

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T00:00:00.000Z",
      bundleVersionId: "bundle-0001",
      userRequest: "Recover after a correction.",
      agentMessages: [],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Prefer rollout status before retrying."
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
      createdAt: "2026-04-08T00:01:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T00:02:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T00:03:00.000Z"
    });

    const rawState = JSON.parse(readFileSync(stateFilePath, "utf8"));
    expect(rawState.learningRecords).toHaveLength(1);
    expect(rawState.evalArtifacts).toHaveLength(2);
    expect(rawState.candidates).toHaveLength(1);
    expect(rawState.validationResults).toHaveLength(1);

    const restoredStore = await createFileBackedCapabilityImprovementStore({ stateFilePath });
    expect(restoredStore.listLearningRecords()).toHaveLength(1);
    expect(restoredStore.listEvalArtifacts()).toHaveLength(2);
    expect(restoredStore.listCandidates()).toHaveLength(1);
    expect(restoredStore.listValidationResults()).toHaveLength(1);
  });
});
