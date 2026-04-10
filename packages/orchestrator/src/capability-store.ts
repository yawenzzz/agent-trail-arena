import type {
  BundleChange,
  CandidateValidationResult,
  EvalArtifactExecutionResult,
  EvalCaseArtifact,
  GuardrailEvaluation,
  ImprovementCandidate,
  MetricComparison,
  MetricSnapshot,
  ProductionLearningRecord,
  ProductionTraceInput,
  ProductionTraceRecord,
  PromotionDecision,
  RollbackEvent,
  ServingBundle,
  ServingBundleVersion
} from "../../domain/src/index.js";
import { candidateTouchesApprovalRequiredSurface } from "../../domain/src/index.js";
import { runCandidateValidationHarness } from "./candidate-validation-harness.js";
import { runEvalArtifact } from "./eval-runner-adapter.js";

export interface InitializeServingBundleInput {
  readonly createdAt: string;
  readonly bundle: ServingBundle;
  readonly changes: readonly BundleChange[];
}

export interface CreateCandidateInput {
  readonly createdAt: string;
  readonly rationale: string;
  readonly linkedLearningRecordIds: readonly string[];
  readonly linkedEvalArtifactIds: readonly string[];
  readonly changes: readonly BundleChange[];
}

export interface PromoteCandidateInput {
  readonly candidateId: string;
  readonly promotedAt: string;
  readonly bundle: ServingBundle;
}

export interface RollbackBundleInput {
  readonly rolledBackAt: string;
  readonly reason: string;
  readonly triggeredBy: RollbackEvent["triggeredBy"];
}

export interface IngestProductionTraceResult {
  readonly trace: ProductionTraceRecord;
  readonly learningRecords: readonly ProductionLearningRecord[];
}

export interface CapabilityImprovementStoreState {
  readonly counters: {
    readonly bundleCount: number;
    readonly candidateCount: number;
    readonly promotionCount: number;
    readonly rollbackCount: number;
    readonly traceCount: number;
    readonly learningCount: number;
    readonly artifactCount: number;
    readonly validationCount: number;
    readonly snapshotCount: number;
    readonly comparisonCount: number;
    readonly evaluationCount: number;
  };
  readonly servingBundles: readonly ServingBundleVersion[];
  readonly candidates: readonly ImprovementCandidate[];
  readonly productionTraces: readonly ProductionTraceRecord[];
  readonly learningRecords: readonly ProductionLearningRecord[];
  readonly evalArtifacts: readonly EvalCaseArtifact[];
  readonly evalExecutionResults: readonly EvalArtifactExecutionResult[];
  readonly validationResults: readonly CandidateValidationResult[];
  readonly promotionDecisions: readonly PromotionDecision[];
  readonly rollbackEvents: readonly RollbackEvent[];
  readonly metricSnapshots: readonly MetricSnapshot[];
  readonly metricComparisons: readonly MetricComparison[];
  readonly guardrailEvaluations: readonly GuardrailEvaluation[];
}

export interface CapabilityImprovementStore {
  initializeServingBundle(input: InitializeServingBundleInput): ServingBundleVersion;
  createCandidate(input: CreateCandidateInput): ImprovementCandidate;
  promoteCandidate(input: PromoteCandidateInput): PromotionDecision;
  rollbackActiveBundle(input: RollbackBundleInput): RollbackEvent;
  ingestProductionTrace(input: ProductionTraceInput): IngestProductionTraceResult;
  getProductionTrace(traceId: string): ProductionTraceRecord | undefined;
  listLearningRecords(): readonly ProductionLearningRecord[];
  synthesizeEvalArtifactsFromLearningRecord(input: {
    learningRecordId: string;
    createdAt: string;
  }): readonly EvalCaseArtifact[];
  listEvalArtifacts(): readonly EvalCaseArtifact[];
  executeEvalArtifact(input: {
    artifactId: string;
    executedAt: string;
  }): EvalArtifactExecutionResult;
  listEvalExecutionResults(): readonly EvalArtifactExecutionResult[];
  generateCandidateFromLearningRecord(input: {
    learningRecordId: string;
    createdAt: string;
  }): ImprovementCandidate;
  validateCandidate(input: {
    candidateId: string;
    validatedAt: string;
  }): CandidateValidationResult;
  listValidationResults(): readonly CandidateValidationResult[];
  listCandidates(): readonly ImprovementCandidate[];
  getActiveServingBundle(): ServingBundleVersion;
  getServingBundleVersion(bundleVersionId: string): ServingBundleVersion | undefined;
  listPromotionDecisions(): readonly PromotionDecision[];
  listRollbackEvents(): readonly RollbackEvent[];
  recordMetricSnapshot(input: {
    bundleVersionId: string;
    capturedAt: string;
    totalRuns: number;
    successfulRuns: number;
    userCorrectionCount: number;
    humanTakeoverCount: number;
    interruptedRuns: number;
    retryCount: number;
    stuckRuns: number;
  }): MetricSnapshot;
  listMetricSnapshots(): readonly MetricSnapshot[];
  compareMetricSnapshots(input: {
    baselineSnapshotId: string;
    observedSnapshotId: string;
    comparedAt: string;
  }): MetricComparison;
  evaluateRollbackGuardrails(input: {
    activeBundleVersionId: string;
    baselineSnapshotId: string;
    observedSnapshotId: string;
    evaluatedAt: string;
    triggerRollback?: boolean;
  }): GuardrailEvaluation;
  listGuardrailEvaluations(): readonly GuardrailEvaluation[];
  exportState(): CapabilityImprovementStoreState;
}

function summarizeReplayEvent(
  event: ProductionTraceRecord["replayEvents"][number]
): string {
  switch (event.type) {
    case "run.started":
      return `Run started for scenario ${event.scenarioId}.`;
    case "agent.summary":
      return event.text;
    case "tool.called": {
      const input = event.input as { cmd?: string };
      return typeof input?.cmd === "string"
        ? `Tool ${event.toolName} called with command: ${input.cmd}.`
        : `Tool ${event.toolName} called.`;
    }
    case "judge.update":
      return `Judge update: ${event.summary}`;
    case "run.completed":
      return `Run completed with outcome ${event.result.outcome}.`;
  }
}

export function createInMemoryCapabilityImprovementStore(
  initialState?: CapabilityImprovementStoreState
): CapabilityImprovementStore {
  let bundleCount = initialState?.counters.bundleCount ?? 0;
  let candidateCount = initialState?.counters.candidateCount ?? 0;
  let promotionCount = initialState?.counters.promotionCount ?? 0;
  let rollbackCount = initialState?.counters.rollbackCount ?? 0;
  let traceCount = initialState?.counters.traceCount ?? 0;
  let learningCount = initialState?.counters.learningCount ?? 0;
  let artifactCount = initialState?.counters.artifactCount ?? 0;
  let validationCount = initialState?.counters.validationCount ?? 0;
  let snapshotCount = initialState?.counters.snapshotCount ?? 0;
  let comparisonCount = initialState?.counters.comparisonCount ?? 0;
  let evaluationCount = initialState?.counters.evaluationCount ?? 0;

  const servingBundles = new Map<string, ServingBundleVersion>(
    (initialState?.servingBundles ?? []).map((bundle) => [
      bundle.bundleVersionId,
      structuredClone(bundle)
    ])
  );
  const candidates = new Map<string, ImprovementCandidate>(
    (initialState?.candidates ?? []).map((candidate) => [
      candidate.candidateId,
      structuredClone(candidate)
    ])
  );
  const productionTraces = new Map<string, ProductionTraceRecord>(
    (initialState?.productionTraces ?? []).map((trace) => [trace.traceId, structuredClone(trace)])
  );
  const learningRecords: ProductionLearningRecord[] = [
    ...structuredClone(initialState?.learningRecords ?? [])
  ];
  const evalArtifacts: EvalCaseArtifact[] = [
    ...structuredClone(initialState?.evalArtifacts ?? [])
  ];
  const evalExecutionResults: EvalArtifactExecutionResult[] = [
    ...structuredClone(initialState?.evalExecutionResults ?? [])
  ];
  const validationResults: CandidateValidationResult[] = [
    ...structuredClone(initialState?.validationResults ?? [])
  ];
  const promotionDecisions: PromotionDecision[] = [
    ...structuredClone(initialState?.promotionDecisions ?? [])
  ];
  const rollbackEvents: RollbackEvent[] = [
    ...structuredClone(initialState?.rollbackEvents ?? [])
  ];
  const metricSnapshots: MetricSnapshot[] = [
    ...structuredClone(initialState?.metricSnapshots ?? [])
  ];
  const metricComparisons: MetricComparison[] = [
    ...structuredClone(initialState?.metricComparisons ?? [])
  ];
  const guardrailEvaluations: GuardrailEvaluation[] = [
    ...structuredClone(initialState?.guardrailEvaluations ?? [])
  ];

  if (servingBundles.size === 0) {
    const defaultBundle = initializeDefaultBundle();
    servingBundles.set(defaultBundle.bundleVersionId, structuredClone(defaultBundle));
    bundleCount = defaultBundle.versionNumber;
  }

  return {
    initializeServingBundle(input) {
      bundleCount += 1;
      const bundleVersion: ServingBundleVersion = {
        bundleVersionId: `bundle-${String(bundleCount).padStart(4, "0")}`,
        versionNumber: bundleCount,
        createdAt: input.createdAt,
        status: "active",
        bundle: structuredClone(input.bundle),
        changes: structuredClone(input.changes)
      };

      for (const [bundleId, bundle] of servingBundles.entries()) {
        if (bundle.status === "active") {
          servingBundles.set(bundleId, {
            ...bundle,
            status: "superseded"
          });
        }
      }

      servingBundles.set(bundleVersion.bundleVersionId, structuredClone(bundleVersion));
      return structuredClone(bundleVersion);
    },

    createCandidate(input) {
      candidateCount += 1;
      const approvalRequired = candidateTouchesApprovalRequiredSurface({
        changes: input.changes
      });
      const candidate: ImprovementCandidate = {
        candidateId: `candidate-${String(candidateCount).padStart(4, "0")}`,
        createdAt: input.createdAt,
        status: approvalRequired ? "approval-required" : "draft",
        rationale: input.rationale,
        linkedLearningRecordIds: structuredClone(input.linkedLearningRecordIds),
        linkedEvalArtifactIds: structuredClone(input.linkedEvalArtifactIds),
        approvalRequired,
        changes: structuredClone(input.changes)
      };

      candidates.set(candidate.candidateId, structuredClone(candidate));
      return structuredClone(candidate);
    },

    promoteCandidate(input) {
      const candidate = candidates.get(input.candidateId);
      if (!candidate) {
        throw new Error(`Unknown candidate: ${input.candidateId}`);
      }

      const activeBundle = this.getActiveServingBundle();
      promotionCount += 1;

      if (candidate.approvalRequired) {
        const decision: PromotionDecision = {
          decisionId: `promotion-${String(promotionCount).padStart(4, "0")}`,
          candidateId: candidate.candidateId,
          decidedAt: input.promotedAt,
          outcome: "approval-required",
          reasons: ["Candidate touches approval-required surfaces."],
          activeBundleVersionId: activeBundle.bundleVersionId,
          previousActiveBundleVersionId: activeBundle.bundleVersionId
        };
        promotionDecisions.push(structuredClone(decision));
        return decision;
      }

      if (
        candidate.validationResult?.allNewEvalCasesPass !== true ||
        candidate.validationResult?.safetyRiskDelta !== "none"
      ) {
        const decision: PromotionDecision = {
          decisionId: `promotion-${String(promotionCount).padStart(4, "0")}`,
          candidateId: candidate.candidateId,
          decidedAt: input.promotedAt,
          outcome: "rejected",
          reasons: ["Candidate has not passed validation gates."],
          activeBundleVersionId: activeBundle.bundleVersionId,
          previousActiveBundleVersionId: activeBundle.bundleVersionId
        };
        promotionDecisions.push(structuredClone(decision));
        candidates.set(candidate.candidateId, {
          ...candidate,
          status: "rejected"
        });
        return decision;
      }

      servingBundles.set(activeBundle.bundleVersionId, {
        ...activeBundle,
        status: "superseded"
      });

      bundleCount += 1;
      const promotedBundle: ServingBundleVersion = {
        bundleVersionId: `bundle-${String(bundleCount).padStart(4, "0")}`,
        versionNumber: bundleCount,
        createdAt: input.promotedAt,
        status: "active",
        bundle: structuredClone(input.bundle),
        changes: structuredClone(candidate.changes),
        sourceCandidateId: candidate.candidateId,
        parentBundleVersionId: activeBundle.bundleVersionId,
        previousActiveBundleVersionId: activeBundle.bundleVersionId
      };
      servingBundles.set(promotedBundle.bundleVersionId, structuredClone(promotedBundle));
      candidates.set(candidate.candidateId, {
        ...candidate,
        status: "promoted"
      });

      const decision: PromotionDecision = {
        decisionId: `promotion-${String(promotionCount).padStart(4, "0")}`,
        candidateId: candidate.candidateId,
        decidedAt: input.promotedAt,
        outcome: "promoted",
        reasons: [],
        activeBundleVersionId: promotedBundle.bundleVersionId,
        previousActiveBundleVersionId: activeBundle.bundleVersionId,
        promotedBundleVersionId: promotedBundle.bundleVersionId
      };
      promotionDecisions.push(structuredClone(decision));
      return decision;
    },

    rollbackActiveBundle(input) {
      const activeBundle = this.getActiveServingBundle();
      const previousBundleVersionId = activeBundle.previousActiveBundleVersionId;

      if (!previousBundleVersionId) {
        throw new Error(`Active bundle ${activeBundle.bundleVersionId} has no rollback target.`);
      }

      const previousBundle = this.getServingBundleVersion(previousBundleVersionId);
      if (!previousBundle) {
        throw new Error(`Unknown previous bundle: ${previousBundleVersionId}`);
      }

      rollbackCount += 1;
      servingBundles.set(activeBundle.bundleVersionId, {
        ...activeBundle,
        status: "rolled-back"
      });
      servingBundles.set(previousBundle.bundleVersionId, {
        ...previousBundle,
        status: "active"
      });

      const rollbackEvent: RollbackEvent = {
        rollbackEventId: `rollback-${String(rollbackCount).padStart(4, "0")}`,
        rolledBackAt: input.rolledBackAt,
        reason: input.reason,
        triggeredBy: input.triggeredBy,
        restoredBundleVersionId: previousBundle.bundleVersionId,
        replacedBundleVersionId: activeBundle.bundleVersionId
      };
      rollbackEvents.push(structuredClone(rollbackEvent));
      return rollbackEvent;
    },

    ingestProductionTrace(input) {
      traceCount += 1;
      const traceId = `trace-${String(traceCount).padStart(4, "0")}`;
      const replayEvents: ProductionTraceRecord["replayEvents"] = [
        {
          type: "run.started",
          runId: traceId,
          scenarioId: "production-feedback"
        },
        {
          type: "judge.update",
          summary: `User request: ${input.userRequest}`
        },
        ...input.agentMessages.map((message) => ({
          type: "agent.summary" as const,
          text: message.text
        })),
        ...input.toolCalls.map((toolCall) => ({
          type: "tool.called" as const,
          toolName: toolCall.toolName,
          input: toolCall.input
        })),
        ...input.userCorrections.map((correction) => ({
          type: "judge.update" as const,
          summary: correction.summary
        })),
        ...(input.signals.retryCount > 0
          ? [
              {
                type: "judge.update" as const,
                summary: `Retry count: ${input.signals.retryCount}`
              }
            ]
          : []),
        ...(input.signals.interrupted
          ? [{ type: "judge.update" as const, summary: "Run was interrupted." }]
          : []),
        ...(input.signals.stuck
          ? [{ type: "judge.update" as const, summary: "Run marked as stuck." }]
          : []),
        ...(input.signals.humanTakeover
          ? [
              {
                type: "judge.update" as const,
                summary: "Run required human takeover."
              }
            ]
          : []),
        {
          type: "run.completed",
          result: {
            scenarioId: "production-feedback",
            scenarioType: "workflow",
            outcome: input.terminalOutcome.status,
            summary: input.terminalOutcome.summary
          }
        }
      ];

      const evidenceAnchors = replayEvents.map((event, eventIndex) => ({
        anchorId: `${traceId}:event:${eventIndex}`,
        runId: traceId,
        eventType: event.type,
        eventIndex,
        summary: summarizeReplayEvent(event)
      }));

      const trace: ProductionTraceRecord = {
        traceId,
        ...structuredClone(input),
        replayEvents,
        evidenceAnchors
      };
      productionTraces.set(trace.traceId, structuredClone(trace));

      learningCount += 1;
      const learningRecord: ProductionLearningRecord = {
        learningRecordId: `learning-${String(learningCount).padStart(4, "0")}`,
        traceId,
        createdAt: input.capturedAt,
        issueClass: "recovery",
        evidenceAnchors: structuredClone(evidenceAnchors),
        rootCauseHypothesis:
          "The run required recovery-oriented guidance after real-user corrections.",
        recoveryBehavior:
          input.signals.retryCount > 0 || input.signals.stuck
            ? "Retry/stuck signals indicate recovery behavior degraded."
            : "Recovery degradation inferred from the correction/takeover signal.",
        userCorrectionSummary: input.userCorrections[0]?.summary,
        recommendedChangeType: "knowledge"
      };
      learningRecords.push(structuredClone(learningRecord));

      return {
        trace: structuredClone(trace),
        learningRecords: [structuredClone(learningRecord)]
      };
    },

    getProductionTrace(traceId) {
      const trace = productionTraces.get(traceId);
      return trace ? structuredClone(trace) : undefined;
    },

    listLearningRecords() {
      return structuredClone(learningRecords);
    },

    synthesizeEvalArtifactsFromLearningRecord(input) {
      const learningRecord = learningRecords.find(
        (record) => record.learningRecordId === input.learningRecordId
      );
      if (!learningRecord) {
        throw new Error(`Unknown learning record: ${input.learningRecordId}`);
      }

      const trace = productionTraces.get(learningRecord.traceId);
      if (!trace) {
        throw new Error(
          `Unknown production trace for learning record: ${learningRecord.traceId}`
        );
      }

      const replayArtifact: EvalCaseArtifact = {
        artifactId: `artifact-${String(++artifactCount).padStart(4, "0")}`,
        artifactType: "replay",
        createdAt: input.createdAt,
        sourceTraceId: trace.traceId,
        sourceLearningRecordIds: [learningRecord.learningRecordId],
        regressionTags: [learningRecord.issueClass, learningRecord.recommendedChangeType],
        successPredicate: trace.terminalOutcome.summary,
        safetyPredicate: `No new safety risk for ${learningRecord.recommendedChangeType} updates.`,
        replayEvents: structuredClone(trace.replayEvents)
      };
      const evalArtifact: EvalCaseArtifact = {
        artifactId: `artifact-${String(++artifactCount).padStart(4, "0")}`,
        artifactType: "eval",
        createdAt: input.createdAt,
        sourceTraceId: trace.traceId,
        sourceLearningRecordIds: [learningRecord.learningRecordId],
        regressionTags: [learningRecord.issueClass, "production-feedback"],
        successPredicate: `Reproduce and prevent: ${learningRecord.rootCauseHypothesis}`,
        safetyPredicate: `Safety judge must stay neutral for ${learningRecord.learningRecordId}.`
      };

      evalArtifacts.push(structuredClone(replayArtifact), structuredClone(evalArtifact));
      return [replayArtifact, evalArtifact];
    },

    listEvalArtifacts() {
      return structuredClone(evalArtifacts);
    },

    executeEvalArtifact(input) {
      const artifact = evalArtifacts.find((item) => item.artifactId === input.artifactId);
      if (!artifact) {
        throw new Error(`Unknown eval artifact: ${input.artifactId}`);
      }

      const result = runEvalArtifact({
        artifact,
        executedAt: input.executedAt
      });
      evalExecutionResults.push(structuredClone(result));
      return result;
    },

    listEvalExecutionResults() {
      return structuredClone(evalExecutionResults);
    },

    generateCandidateFromLearningRecord(input) {
      const learningRecord = learningRecords.find(
        (record) => record.learningRecordId === input.learningRecordId
      );
      if (!learningRecord) {
        throw new Error(`Unknown learning record: ${input.learningRecordId}`);
      }

      const linkedEvalArtifactIds = evalArtifacts
        .filter((artifact) =>
          artifact.sourceLearningRecordIds.includes(learningRecord.learningRecordId)
        )
        .map((artifact) => artifact.artifactId);
      const surface = learningRecord.recommendedChangeType;

      return this.createCandidate({
        createdAt: input.createdAt,
        rationale: `Address ${learningRecord.issueClass} issue from ${learningRecord.learningRecordId}.`,
        linkedLearningRecordIds: [learningRecord.learningRecordId],
        linkedEvalArtifactIds,
        changes: [
          {
            surface,
            summary: `Improve ${surface} handling for ${learningRecord.issueClass}.`,
            diff:
              surface === "prompt"
                ? `+ Add prompt guidance: ${learningRecord.rootCauseHypothesis}`
                : surface === "memory"
                  ? `+ Remember: ${learningRecord.recoveryBehavior}`
                  : `+ Knowledge: ${learningRecord.userCorrectionSummary ?? learningRecord.rootCauseHypothesis}`
          }
        ]
      });
    },

    validateCandidate(input) {
      const candidate = candidates.get(input.candidateId);
      if (!candidate) {
        throw new Error(`Unknown candidate: ${input.candidateId}`);
      }

      const linkedArtifacts = evalArtifacts.filter((artifact) =>
        candidate.linkedEvalArtifactIds.includes(artifact.artifactId)
      );
      const sourceLearningRecords = learningRecords.filter((record) =>
        candidate.linkedLearningRecordIds.includes(record.learningRecordId)
      );
      const missingArtifactIds = candidate.linkedEvalArtifactIds.filter(
        (artifactId) => !linkedArtifacts.some((artifact) => artifact.artifactId === artifactId)
      );
      const validationResult = runCandidateValidationHarness({
        candidate,
        linkedArtifacts,
        sourceLearningRecords,
        missingArtifactIds,
        validationId: `validation-${String(++validationCount).padStart(4, "0")}`,
        validatedAt: input.validatedAt
      });
      validationResults.push(structuredClone(validationResult));
      candidates.set(candidate.candidateId, {
        ...candidate,
        status:
          validationResult.allNewEvalCasesPass && validationResult.safetyRiskDelta === "none"
            ? "validated"
            : candidate.approvalRequired
              ? "approval-required"
              : "rejected",
        validationResult
      });

      return validationResult;
    },

    listValidationResults() {
      return structuredClone(validationResults);
    },

    listCandidates() {
      return [...candidates.values()].map((candidate) => structuredClone(candidate));
    },

    getActiveServingBundle() {
      const activeBundle = [...servingBundles.values()].find(
        (bundle) => bundle.status === "active"
      );
      if (!activeBundle) {
        throw new Error("No active serving bundle configured.");
      }

      return structuredClone(activeBundle);
    },

    getServingBundleVersion(bundleVersionId) {
      const bundle = servingBundles.get(bundleVersionId);
      return bundle ? structuredClone(bundle) : undefined;
    },

    listPromotionDecisions() {
      return structuredClone(promotionDecisions);
    },

    listRollbackEvents() {
      return structuredClone(rollbackEvents);
    },

    recordMetricSnapshot(input) {
      const safeDivide = (value: number) =>
        input.totalRuns === 0 ? 0 : Number((value / input.totalRuns).toFixed(4));
      const snapshot: MetricSnapshot = {
        snapshotId: `snapshot-${String(++snapshotCount).padStart(4, "0")}`,
        bundleVersionId: input.bundleVersionId,
        capturedAt: input.capturedAt,
        totalRuns: input.totalRuns,
        successRate: safeDivide(input.successfulRuns),
        userCorrectionRate: safeDivide(input.userCorrectionCount),
        humanTakeoverRate: safeDivide(input.humanTakeoverCount),
        interruptedRate: safeDivide(input.interruptedRuns),
        retryPerRun: safeDivide(input.retryCount),
        stuckRate: safeDivide(input.stuckRuns)
      };
      metricSnapshots.push(structuredClone(snapshot));
      return snapshot;
    },

    listMetricSnapshots() {
      return structuredClone(metricSnapshots);
    },

    compareMetricSnapshots(input) {
      const baseline = metricSnapshots.find(
        (snapshot) => snapshot.snapshotId === input.baselineSnapshotId
      );
      const observed = metricSnapshots.find(
        (snapshot) => snapshot.snapshotId === input.observedSnapshotId
      );
      if (!baseline || !observed) {
        throw new Error("Unknown metric snapshot for comparison.");
      }

      const comparison: MetricComparison = {
        comparisonId: `comparison-${String(++comparisonCount).padStart(4, "0")}`,
        baselineSnapshotId: baseline.snapshotId,
        observedSnapshotId: observed.snapshotId,
        comparedAt: input.comparedAt,
        successRateDelta: Number((observed.successRate - baseline.successRate).toFixed(4)),
        userCorrectionRateDelta: Number(
          (observed.userCorrectionRate - baseline.userCorrectionRate).toFixed(4)
        ),
        humanTakeoverRateDelta: Number(
          (observed.humanTakeoverRate - baseline.humanTakeoverRate).toFixed(4)
        ),
        interruptedRateDelta: Number(
          (observed.interruptedRate - baseline.interruptedRate).toFixed(4)
        ),
        retryPerRunDelta: Number((observed.retryPerRun - baseline.retryPerRun).toFixed(4)),
        stuckRateDelta: Number((observed.stuckRate - baseline.stuckRate).toFixed(4))
      };
      metricComparisons.push(structuredClone(comparison));
      return comparison;
    },

    evaluateRollbackGuardrails(input) {
      const comparison = this.compareMetricSnapshots({
        baselineSnapshotId: input.baselineSnapshotId,
        observedSnapshotId: input.observedSnapshotId,
        comparedAt: input.evaluatedAt
      });
      const regressions = [
        ...(comparison.successRateDelta < 0 ? ["success_rate_down"] : []),
        ...(comparison.userCorrectionRateDelta > 0 ? ["user_correction_rate_up"] : []),
        ...(comparison.humanTakeoverRateDelta > 0 ? ["human_takeover_rate_up"] : []),
        ...(comparison.interruptedRateDelta > 0 ? ["interrupted_rate_up"] : []),
        ...(comparison.retryPerRunDelta > 0 ? ["retry_per_run_up"] : []),
        ...(comparison.stuckRateDelta > 0 ? ["stuck_rate_up"] : [])
      ];
      let rollbackEventId: string | undefined;

      if (input.triggerRollback && regressions.length > 0) {
        const rollbackEvent = this.rollbackActiveBundle({
          rolledBackAt: input.evaluatedAt,
          reason: `Guardrail regressions detected: ${regressions.join(", ")}`,
          triggeredBy: "metric_guardrail"
        });
        rollbackEventId = rollbackEvent.rollbackEventId;
      }

      const evaluation: GuardrailEvaluation = {
        evaluationId: `guardrail-${String(++evaluationCount).padStart(4, "0")}`,
        activeBundleVersionId: input.activeBundleVersionId,
        baselineSnapshotId: input.baselineSnapshotId,
        observedSnapshotId: input.observedSnapshotId,
        evaluatedAt: input.evaluatedAt,
        regressions,
        shouldRollback: regressions.length > 0,
        triggeredRollbackEventId: rollbackEventId
      };
      guardrailEvaluations.push(structuredClone(evaluation));
      return evaluation;
    },

    listGuardrailEvaluations() {
      return structuredClone(guardrailEvaluations);
    },

    exportState() {
      return {
        counters: {
          bundleCount,
          candidateCount,
          promotionCount,
          rollbackCount,
          traceCount,
          learningCount,
          artifactCount,
          validationCount,
          snapshotCount,
          comparisonCount,
          evaluationCount
        },
        servingBundles: [...servingBundles.values()].map((bundle) => structuredClone(bundle)),
        candidates: [...candidates.values()].map((candidate) => structuredClone(candidate)),
        productionTraces: [...productionTraces.values()].map((trace) => structuredClone(trace)),
        learningRecords: structuredClone(learningRecords),
        evalArtifacts: structuredClone(evalArtifacts),
        evalExecutionResults: structuredClone(evalExecutionResults),
        validationResults: structuredClone(validationResults),
        promotionDecisions: structuredClone(promotionDecisions),
        rollbackEvents: structuredClone(rollbackEvents),
        metricSnapshots: structuredClone(metricSnapshots),
        metricComparisons: structuredClone(metricComparisons),
        guardrailEvaluations: structuredClone(guardrailEvaluations)
      };
    }
  };
}

function initializeDefaultBundle(): ServingBundleVersion {
  return {
    bundleVersionId: "bundle-0001",
    versionNumber: 1,
    createdAt: "2026-04-07T00:00:00.000Z",
    status: "active",
    bundle: {
      prompt: "You are a helpful OpenClaw agent.",
      memory: [],
      knowledge: []
    },
    changes: []
  };
}
