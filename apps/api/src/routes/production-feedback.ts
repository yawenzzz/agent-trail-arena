import type { FastifyInstance } from "fastify";
import {
  resolveServingBundle,
  resolveServingRuntimeConfig,
  runRuntimeWatcher,
  runRuntimeWatcherOnLatestSnapshots,
  watchRuntimeGuardrails,
  type CapabilityImprovementStore
} from "../../../../packages/orchestrator/src/index.js";
import type { ProductionTraceInput } from "../../../../packages/domain/src/index.js";

interface ProductionFeedbackRouteOptions {
  readonly capabilityStore: CapabilityImprovementStore;
}

interface CreateProductionTraceBody extends Partial<ProductionTraceInput> {
  readonly request?: string;
  readonly retryCount?: number;
  readonly interrupted?: boolean;
  readonly stuck?: boolean;
  readonly humanTakeover?: boolean;
}

interface PromoteCandidateBody {
  readonly bundle: {
    readonly prompt: string;
    readonly memory: readonly string[];
    readonly knowledge: readonly string[];
  };
  readonly promotedAt?: string;
}

interface RollbackBody {
  readonly reason: string;
  readonly triggeredBy?: "operator" | "metric_guardrail";
  readonly rolledBackAt?: string;
}

interface MetricSnapshotBody {
  readonly bundleVersionId: string;
  readonly capturedAt?: string;
  readonly totalRuns: number;
  readonly successfulRuns: number;
  readonly userCorrectionCount: number;
  readonly humanTakeoverCount: number;
  readonly interruptedRuns: number;
  readonly retryCount: number;
  readonly stuckRuns: number;
}

interface MetricComparisonBody {
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly comparedAt?: string;
}

interface GuardrailEvaluationBody {
  readonly activeBundleVersionId: string;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly evaluatedAt?: string;
  readonly triggerRollback?: boolean;
}

interface RuntimeWatcherLoopBody {
  readonly baselineSnapshotId?: string;
  readonly observedSnapshotId?: string;
  readonly tickCount: number;
  readonly intervalMs?: number;
  readonly evaluatedAtSeed?: string;
  readonly triggerRollbackOnFinalTick?: boolean;
}

export function registerProductionFeedbackRoutes(
  app: FastifyInstance,
  options: ProductionFeedbackRouteOptions
) {
  app.post("/production-runs", async (request, reply) => {
    const body = request.body as CreateProductionTraceBody;
    const activeBundle = options.capabilityStore.getActiveServingBundle();
    const ingestion = options.capabilityStore.ingestProductionTrace({
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      bundleVersionId: body.bundleVersionId ?? activeBundle.bundleVersionId,
      userRequest: body.userRequest ?? body.request ?? "",
      agentMessages: structuredClone(body.agentMessages ?? []),
      toolCalls: structuredClone(body.toolCalls ?? []),
      userCorrections: structuredClone(body.userCorrections ?? []),
      signals: structuredClone(
        body.signals ?? {
          retryCount: body.retryCount ?? 0,
          interrupted: body.interrupted ?? false,
          stuck: body.stuck ?? false,
          humanTakeover: body.humanTakeover ?? false
        }
      ),
      terminalOutcome:
        body.terminalOutcome ?? {
          status: "failed",
          summary: "No terminal outcome provided."
        }
    });

    reply.code(201);
    return {
      traceId: ingestion.trace.traceId,
      bundleVersionId: ingestion.trace.bundleVersionId,
      learningRecordIds: ingestion.learningRecords.map((record) => record.learningRecordId),
      replayEventCount: ingestion.trace.replayEvents.length
    };
  });

  app.get("/production-runs/:traceId", async (request, reply) => {
    const { traceId } = request.params as { traceId: string };
    const trace = options.capabilityStore.getProductionTrace(traceId);

    if (!trace) {
      reply.code(404);
      return {
        message: `Unknown production trace: ${traceId}`
      };
    }

    return trace;
  });

  app.get("/learning-records", async () => options.capabilityStore.listLearningRecords());
  app.post("/learning-records/:learningRecordId/synthesize-artifacts", async (request) => {
    const { learningRecordId } = request.params as { learningRecordId: string };
    return {
      artifacts: options.capabilityStore.synthesizeEvalArtifactsFromLearningRecord({
        learningRecordId,
        createdAt: new Date().toISOString()
      })
    };
  });
  app.post("/learning-records/:learningRecordId/candidates", async (request, reply) => {
    const { learningRecordId } = request.params as { learningRecordId: string };
    const candidate = options.capabilityStore.generateCandidateFromLearningRecord({
      learningRecordId,
      createdAt: new Date().toISOString()
    });
    reply.code(201);
    return { candidate };
  });
  app.post("/candidates/:candidateId/validate", async (request) => {
    const { candidateId } = request.params as { candidateId: string };
    return {
      validation: options.capabilityStore.validateCandidate({
        candidateId,
        validatedAt: new Date().toISOString()
      })
    };
  });
  app.get("/candidates", async () => options.capabilityStore.listCandidates());
  app.get("/candidate-validations", async () =>
    options.capabilityStore.listValidationResults()
  );
  app.post("/candidates/:candidateId/promote", async (request) => {
    const { candidateId } = request.params as { candidateId: string };
    const body = request.body as PromoteCandidateBody;

    return options.capabilityStore.promoteCandidate({
      candidateId,
      promotedAt: body.promotedAt ?? new Date().toISOString(),
      bundle: body.bundle
    });
  });
  app.get("/eval-artifacts", async () => options.capabilityStore.listEvalArtifacts());
  app.post("/eval-artifacts/:artifactId/execute", async (request) => {
    const { artifactId } = request.params as { artifactId: string };
    return {
      execution: options.capabilityStore.executeEvalArtifact({
        artifactId,
        executedAt: new Date().toISOString()
      })
    };
  });
  app.get("/eval-executions", async () => options.capabilityStore.listEvalExecutionResults());
  app.get("/serving-bundles", async () => {
    const bundles: ReturnType<CapabilityImprovementStore["getActiveServingBundle"]>[] = [];
    let current:
      | ReturnType<CapabilityImprovementStore["getActiveServingBundle"]>
      | undefined = options.capabilityStore.getActiveServingBundle();

    while (current) {
      bundles.unshift(current);
      current = current.previousActiveBundleVersionId
        ? options.capabilityStore.getServingBundleVersion(current.previousActiveBundleVersionId)
        : undefined;
    }

    return bundles;
  });
  app.get("/serving-bundles/active", async () =>
    resolveServingBundle(options.capabilityStore)
  );
  app.get("/serving-bundles/active/runtime-config", async () =>
    resolveServingRuntimeConfig(resolveServingBundle(options.capabilityStore))
  );
  app.get("/serving-bundles/:bundleVersionId", async (request, reply) => {
    const { bundleVersionId } = request.params as { bundleVersionId: string };

    try {
      return resolveServingBundle(options.capabilityStore, bundleVersionId);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unknown serving bundle:")) {
        reply.code(404);
        return {
          message: error.message
        };
      }

      throw error;
    }
  });
  app.post("/serving-bundles/rollback", async (request) => {
    const body = request.body as RollbackBody;

    return options.capabilityStore.rollbackActiveBundle({
      rolledBackAt: body.rolledBackAt ?? new Date().toISOString(),
      reason: body.reason,
      triggeredBy: body.triggeredBy ?? "operator"
    });
  });
  app.get("/promotion-decisions", async () => options.capabilityStore.listPromotionDecisions());
  app.get("/rollback-events", async () => options.capabilityStore.listRollbackEvents());
  app.post("/metrics/snapshots", async (request, reply) => {
    const body = request.body as MetricSnapshotBody;
    const snapshot = options.capabilityStore.recordMetricSnapshot({
      ...body,
      capturedAt: body.capturedAt ?? new Date().toISOString()
    });
    reply.code(201);
    return { snapshot };
  });
  app.get("/metrics/snapshots", async () => options.capabilityStore.listMetricSnapshots());
  app.post("/metrics/compare", async (request) => {
    const body = request.body as MetricComparisonBody;
    return {
      comparison: options.capabilityStore.compareMetricSnapshots({
        baselineSnapshotId: body.baselineSnapshotId,
        observedSnapshotId: body.observedSnapshotId,
        comparedAt: body.comparedAt ?? new Date().toISOString()
      })
    };
  });
  app.post("/metrics/guardrail-evaluations", async (request) => {
    const body = request.body as GuardrailEvaluationBody;
    return {
      evaluation: options.capabilityStore.evaluateRollbackGuardrails({
        activeBundleVersionId: body.activeBundleVersionId,
        baselineSnapshotId: body.baselineSnapshotId,
        observedSnapshotId: body.observedSnapshotId,
        evaluatedAt: body.evaluatedAt ?? new Date().toISOString(),
        triggerRollback: body.triggerRollback ?? false
      })
    };
  });
  app.get("/metrics/guardrail-evaluations", async () =>
    options.capabilityStore.listGuardrailEvaluations()
  );
  app.post("/runtime-watcher/evaluate", async (request) => {
    const body = request.body as GuardrailEvaluationBody;
    return runRuntimeWatcher({
      store: options.capabilityStore,
      baselineSnapshotId: body.baselineSnapshotId,
      observedSnapshotId: body.observedSnapshotId,
      evaluatedAt: body.evaluatedAt ?? new Date().toISOString(),
      triggerRollback: body.triggerRollback ?? false
    });
  });
  app.post("/runtime-watcher/evaluate-latest", async (request) => {
    const body = request.body as Pick<GuardrailEvaluationBody, "evaluatedAt" | "triggerRollback">;
    return runRuntimeWatcherOnLatestSnapshots({
      store: options.capabilityStore,
      evaluatedAt: body.evaluatedAt ?? new Date().toISOString(),
      triggerRollback: body.triggerRollback ?? false
    });
  });
  app.post("/runtime-watcher/watch-loop", async (request) => {
    const body = request.body as RuntimeWatcherLoopBody;
    return watchRuntimeGuardrails({
      store: options.capabilityStore,
      baselineSnapshotId: body.baselineSnapshotId,
      observedSnapshotId: body.observedSnapshotId,
      tickCount: body.tickCount,
      intervalMs: body.intervalMs,
      evaluatedAtSeed: body.evaluatedAtSeed ?? new Date().toISOString(),
      triggerRollbackOnFinalTick: body.triggerRollbackOnFinalTick ?? false,
      sleep: async () => {}
    });
  });
}
