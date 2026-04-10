import { describe, expect, it } from "vitest";
import { createInMemoryCapabilityImprovementStore } from "./capability-store.js";
import {
  resolveServingBundle,
  resolveServingRuntimeConfig
} from "./serving-bundle-resolver.js";

describe("serving bundle resolver", () => {
  it("returns the active serving bundle by default", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const bundle = resolveServingBundle(store);

    expect(bundle).toMatchObject({
      bundleVersionId: "bundle-0001",
      status: "active"
    });
  });

  it("returns runtime config for a promoted bundle", () => {
    const store = createInMemoryCapabilityImprovementStore();

    const ingestion = store.ingestProductionTrace({
      capturedAt: "2026-04-08T01:00:00.000Z",
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
      createdAt: "2026-04-08T01:01:00.000Z"
    });
    const candidate = store.generateCandidateFromLearningRecord({
      learningRecordId: ingestion.learningRecords[0]!.learningRecordId,
      createdAt: "2026-04-08T01:02:00.000Z"
    });
    store.validateCandidate({
      candidateId: candidate.candidateId,
      validatedAt: "2026-04-08T01:03:00.000Z"
    });
    const promotion = store.promoteCandidate({
      candidateId: candidate.candidateId,
      promotedAt: "2026-04-08T01:04:00.000Z",
      bundle: {
        prompt: "Use rollout status before retrying.",
        memory: ["Acknowledge corrections before retries."],
        knowledge: ["Use rollout status before retrying the same command."]
      }
    });

    const bundle = resolveServingBundle(store, promotion.promotedBundleVersionId);
    const runtimeConfig = resolveServingRuntimeConfig(bundle);

    expect(runtimeConfig).toEqual({
      bundleVersionId: "bundle-0002",
      prompt: "Use rollout status before retrying.",
      memory: ["Acknowledge corrections before retries."],
      knowledge: ["Use rollout status before retrying the same command."]
    });
  });
});
