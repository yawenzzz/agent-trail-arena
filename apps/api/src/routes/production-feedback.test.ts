import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function makeCapabilityStorePath() {
  const dir = mkdtempSync(join(tmpdir(), "capability-app-store-"));
  tempDirs.push(dir);
  return join(dir, "capability-store.json");
}

describe("production feedback routes", () => {
  it("ingests a production trace and exposes the stored record plus learning records", async () => {
    const app = buildApp();

    const ingestResponse = await app.inject({
      method: "POST",
      url: "/production-runs",
      payload: {
        capturedAt: "2026-04-07T08:10:00.000Z",
        userRequest: "Investigate why the deployment stalled.",
        agentMessages: [
          {
            messageId: "assistant-1",
            text: "I am checking the deployment events now."
          }
        ],
        toolCalls: [
          {
            callId: "tool-1",
            toolName: "shell.exec",
            input: { cmd: "kubectl get events" },
            outputSummary: "CrashLoopBackOff detected",
            status: "succeeded"
          }
        ],
        userCorrections: [
          {
            correctionId: "correction-1",
            summary: "Use the rollout status command for the current namespace."
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
          summary: "The agent checked the wrong resource and did not confirm rollout state."
        }
      }
    });

    expect(ingestResponse.statusCode).toBe(201);
    expect(ingestResponse.json()).toMatchObject({
      traceId: "trace-0001",
      bundleVersionId: "bundle-0001",
      learningRecordIds: ["learning-0001"],
      replayEventCount: 7
    });

    const traceResponse = await app.inject({
      method: "GET",
      url: "/production-runs/trace-0001"
    });

    expect(traceResponse.statusCode).toBe(200);
    expect(traceResponse.json()).toMatchObject({
      traceId: "trace-0001",
      userRequest: "Investigate why the deployment stalled.",
      bundleVersionId: "bundle-0001"
    });
    expect(traceResponse.json().evidenceAnchors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchorId: "trace-0001:event:1"
        })
      ])
    );

    const learningResponse = await app.inject({
      method: "GET",
      url: "/learning-records"
    });

    expect(learningResponse.statusCode).toBe(200);
    expect(learningResponse.json()).toEqual([
      expect.objectContaining({
        learningRecordId: "learning-0001",
        traceId: "trace-0001",
        recommendedChangeType: "knowledge"
      })
    ]);

    const artifactResponse = await app.inject({
      method: "POST",
      url: "/learning-records/learning-0001/synthesize-artifacts"
    });

    expect(artifactResponse.statusCode).toBe(200);
    expect(artifactResponse.json()).toEqual({
      artifacts: [
        expect.objectContaining({
          artifactId: "artifact-0001",
          artifactType: "replay"
        }),
        expect.objectContaining({
          artifactId: "artifact-0002",
          artifactType: "eval"
        })
      ]
    });

    const evalArtifactsResponse = await app.inject({
      method: "GET",
      url: "/eval-artifacts"
    });
    expect(evalArtifactsResponse.statusCode).toBe(200);
    expect(evalArtifactsResponse.json()).toHaveLength(2);

    const evalExecutionResponse = await app.inject({
      method: "POST",
      url: "/eval-artifacts/artifact-0001/execute"
    });
    expect(evalExecutionResponse.statusCode).toBe(200);
    expect(evalExecutionResponse.json()).toEqual({
      execution: expect.objectContaining({
        artifactId: "artifact-0001",
        passed: true
      })
    });

    const evalExecutionsResponse = await app.inject({
      method: "GET",
      url: "/eval-executions"
    });
    expect(evalExecutionsResponse.statusCode).toBe(200);
    expect(evalExecutionsResponse.json()).toEqual([
      expect.objectContaining({
        artifactId: "artifact-0001"
      })
    ]);

    const candidateResponse = await app.inject({
      method: "POST",
      url: "/learning-records/learning-0001/candidates"
    });
    expect(candidateResponse.statusCode).toBe(201);
    expect(candidateResponse.json()).toEqual({
      candidate: expect.objectContaining({
        candidateId: "candidate-0001",
        linkedLearningRecordIds: ["learning-0001"],
        linkedEvalArtifactIds: ["artifact-0001", "artifact-0002"]
      })
    });

    const validationResponse = await app.inject({
      method: "POST",
      url: "/candidates/candidate-0001/validate"
    });
    expect(validationResponse.statusCode).toBe(200);
    expect(validationResponse.json()).toEqual({
      validation: expect.objectContaining({
        candidateId: "candidate-0001",
        allNewEvalCasesPass: true,
        safetyRiskDelta: "none"
      })
    });

    const promotionResponse = await app.inject({
      method: "POST",
      url: "/candidates/candidate-0001/promote",
      payload: {
        promotedAt: "2026-04-07T08:12:00.000Z",
        bundle: {
          prompt: "You are a helpful OpenClaw agent. Use rollout status before retrying.",
          memory: [],
          knowledge: ["Use rollout status before retrying the same command."]
        }
      }
    });
    expect(promotionResponse.statusCode).toBe(200);
    expect(promotionResponse.json()).toEqual(
      expect.objectContaining({
        outcome: "promoted",
        promotedBundleVersionId: "bundle-0002",
        previousActiveBundleVersionId: "bundle-0001"
      })
    );

    const candidatesResponse = await app.inject({
      method: "GET",
      url: "/candidates"
    });

    expect(candidatesResponse.statusCode).toBe(200);
    expect(candidatesResponse.json()).toEqual([
      expect.objectContaining({
        candidateId: "candidate-0001"
      })
    ]);

    const validationsResponse = await app.inject({
      method: "GET",
      url: "/candidate-validations"
    });
    expect(validationsResponse.statusCode).toBe(200);
    expect(validationsResponse.json()).toEqual([
      expect.objectContaining({
        candidateId: "candidate-0001"
      })
    ]);

    const servingBundlesResponse = await app.inject({
      method: "GET",
      url: "/serving-bundles"
    });

    expect(servingBundlesResponse.statusCode).toBe(200);
    expect(servingBundlesResponse.json()).toEqual([
      expect.objectContaining({
        bundleVersionId: "bundle-0001",
        versionNumber: 1
      }),
      expect.objectContaining({
        bundleVersionId: "bundle-0002",
        versionNumber: 2,
        status: "active"
      })
    ]);

    const activeBundleResponse = await app.inject({
      method: "GET",
      url: "/serving-bundles/active"
    });
    expect(activeBundleResponse.statusCode).toBe(200);
    expect(activeBundleResponse.json()).toEqual(
      expect.objectContaining({
        bundleVersionId: "bundle-0002",
        status: "active"
      })
    );

    const runtimeConfigResponse = await app.inject({
      method: "GET",
      url: "/serving-bundles/active/runtime-config"
    });
    expect(runtimeConfigResponse.statusCode).toBe(200);
    expect(runtimeConfigResponse.json()).toEqual({
      bundleVersionId: "bundle-0002",
      prompt: "You are a helpful OpenClaw agent. Use rollout status before retrying.",
      memory: [],
      knowledge: ["Use rollout status before retrying the same command."]
    });

    const bundleLookupResponse = await app.inject({
      method: "GET",
      url: "/serving-bundles/bundle-0002"
    });
    expect(bundleLookupResponse.statusCode).toBe(200);
    expect(bundleLookupResponse.json()).toEqual(
      expect.objectContaining({
        bundleVersionId: "bundle-0002"
      })
    );

    const rollbackResponse = await app.inject({
      method: "POST",
      url: "/serving-bundles/rollback",
      payload: {
        rolledBackAt: "2026-04-07T08:13:00.000Z",
        reason: "Post-promotion success rate regressed.",
        triggeredBy: "metric_guardrail"
      }
    });
    expect(rollbackResponse.statusCode).toBe(200);
    expect(rollbackResponse.json()).toEqual({
      rollbackEventId: "rollback-0001",
      rolledBackAt: "2026-04-07T08:13:00.000Z",
      reason: "Post-promotion success rate regressed.",
      triggeredBy: "metric_guardrail",
      restoredBundleVersionId: "bundle-0001",
      replacedBundleVersionId: "bundle-0002"
    });

    const promotionHistoryResponse = await app.inject({
      method: "GET",
      url: "/promotion-decisions"
    });
    expect(promotionHistoryResponse.statusCode).toBe(200);
    expect(promotionHistoryResponse.json()).toEqual([
      expect.objectContaining({
        candidateId: "candidate-0001",
        outcome: "promoted"
      })
    ]);

    const rollbackHistoryResponse = await app.inject({
      method: "GET",
      url: "/rollback-events"
    });
    expect(rollbackHistoryResponse.statusCode).toBe(200);
    expect(rollbackHistoryResponse.json()).toEqual([
      expect.objectContaining({
        rollbackEventId: "rollback-0001"
      })
    ]);

    const baselineSnapshotResponse = await app.inject({
      method: "POST",
      url: "/metrics/snapshots",
      payload: {
        bundleVersionId: "bundle-0001",
        capturedAt: "2026-04-07T08:14:00.000Z",
        totalRuns: 10,
        successfulRuns: 8,
        userCorrectionCount: 1,
        humanTakeoverCount: 0,
        interruptedRuns: 0,
        retryCount: 1,
        stuckRuns: 0
      }
    });
    expect(baselineSnapshotResponse.statusCode).toBe(201);

    const observedSnapshotResponse = await app.inject({
      method: "POST",
      url: "/metrics/snapshots",
      payload: {
        bundleVersionId: "bundle-0002",
        capturedAt: "2026-04-07T08:15:00.000Z",
        totalRuns: 10,
        successfulRuns: 6,
        userCorrectionCount: 3,
        humanTakeoverCount: 1,
        interruptedRuns: 1,
        retryCount: 4,
        stuckRuns: 1
      }
    });
    expect(observedSnapshotResponse.statusCode).toBe(201);

    const snapshotsResponse = await app.inject({
      method: "GET",
      url: "/metrics/snapshots"
    });
    expect(snapshotsResponse.statusCode).toBe(200);
    expect(snapshotsResponse.json()).toHaveLength(2);

    const comparisonResponse = await app.inject({
      method: "POST",
      url: "/metrics/compare",
      payload: {
        baselineSnapshotId: "snapshot-0001",
        observedSnapshotId: "snapshot-0002",
        comparedAt: "2026-04-07T08:16:00.000Z"
      }
    });
    expect(comparisonResponse.statusCode).toBe(200);
    expect(comparisonResponse.json()).toEqual({
      comparison: expect.objectContaining({
        successRateDelta: -0.2,
        userCorrectionRateDelta: 0.2,
        retryPerRunDelta: 0.3
      })
    });

    const guardrailResponse = await app.inject({
      method: "POST",
      url: "/metrics/guardrail-evaluations",
      payload: {
        activeBundleVersionId: "bundle-0002",
        baselineSnapshotId: "snapshot-0001",
        observedSnapshotId: "snapshot-0002",
        evaluatedAt: "2026-04-07T08:17:00.000Z",
        triggerRollback: false
      }
    });
    expect(guardrailResponse.statusCode).toBe(200);
    expect(guardrailResponse.json()).toEqual({
      evaluation: expect.objectContaining({
        shouldRollback: true,
        regressions: expect.arrayContaining([
          "success_rate_down",
          "user_correction_rate_up",
          "retry_per_run_up"
        ])
      })
    });

    const guardrailHistoryResponse = await app.inject({
      method: "GET",
      url: "/metrics/guardrail-evaluations"
    });
    expect(guardrailHistoryResponse.statusCode).toBe(200);
    expect(guardrailHistoryResponse.json()).toHaveLength(1);

    const latestWatcherResponse = await app.inject({
      method: "POST",
      url: "/runtime-watcher/evaluate-latest",
      payload: {
        evaluatedAt: "2026-04-07T08:18:00.000Z",
        triggerRollback: false
      }
    });
    expect(latestWatcherResponse.statusCode).toBe(200);
    expect(latestWatcherResponse.json()).toEqual({
      runtimeConfig: expect.objectContaining({
        bundleVersionId: "bundle-0001"
      }),
      evaluation: expect.objectContaining({
        shouldRollback: false
      })
    });

    const loopWatcherResponse = await app.inject({
      method: "POST",
      url: "/runtime-watcher/watch-loop",
      payload: {
        baselineSnapshotId: "snapshot-0001",
        observedSnapshotId: "snapshot-0002",
        tickCount: 2,
        intervalMs: 1,
        evaluatedAtSeed: "2026-04-07T08:19:00.000Z",
        triggerRollbackOnFinalTick: false
      }
    });
    expect(loopWatcherResponse.statusCode).toBe(200);
    expect(loopWatcherResponse.json()).toEqual({
      ticks: [
        expect.objectContaining({
          evaluation: expect.objectContaining({
            shouldRollback: true
          })
        }),
        expect.objectContaining({
          evaluation: expect.objectContaining({
            shouldRollback: true
          })
        })
      ]
    });

    await app.close();
  });

  it("returns 404 for unknown production traces", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/production-runs/trace-missing"
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: "Unknown production trace: trace-missing"
    });

    await app.close();
  });

  it("uses the file-backed capability store when a path is configured", async () => {
    const capabilityStorePath = makeCapabilityStorePath();
    const app = buildApp({ capabilityStorePath });

    const ingestResponse = await app.inject({
      method: "POST",
      url: "/production-runs",
      payload: {
        userRequest: "Persist this production trace.",
        agentMessages: [],
        toolCalls: [],
        userCorrections: [],
        signals: {
          retryCount: 0,
          interrupted: false,
          stuck: false,
          humanTakeover: false
        },
        terminalOutcome: {
          status: "failed",
          summary: "No-op failure for persistence test."
        }
      }
    });

    expect(ingestResponse.statusCode).toBe(201);
    const persisted = JSON.parse(readFileSync(capabilityStorePath, "utf8"));
    expect(persisted.productionTraces).toEqual([
      expect.objectContaining({
        traceId: "trace-0001"
      })
    ]);
    expect(persisted.learningRecords).toHaveLength(1);

    await app.close();
  });
});
