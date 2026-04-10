import type { EvidenceAnchor } from "./analysis.js";
import type { RunEvent } from "./events.js";

export const changeSurfaces = [
  "prompt",
  "memory",
  "knowledge",
  "tool_permissions",
  "safety_policy"
] as const;
export const autoPromotableChangeSurfaces = ["prompt", "memory", "knowledge"] as const;
export const approvalRequiredChangeSurfaces = [
  "tool_permissions",
  "safety_policy"
] as const;

export type ChangeSurface = (typeof changeSurfaces)[number];
export type AutoPromotableChangeSurface = (typeof autoPromotableChangeSurfaces)[number];
export type ApprovalRequiredChangeSurface = (typeof approvalRequiredChangeSurfaces)[number];
export type ImprovementCandidateStatus =
  | "draft"
  | "validated"
  | "approval-required"
  | "promoted"
  | "rejected";
export type EvalArtifactType = "replay" | "eval";
export type ProductionToolCallStatus = "succeeded" | "failed";
export type ProductionTerminalOutcome = "passed" | "failed" | "errored";
export type ServingBundleStatus = "active" | "superseded" | "rolled-back";
export type PromotionDecisionOutcome = "promoted" | "rejected" | "approval-required";
export type RollbackTrigger = "operator" | "metric_guardrail";

export interface ServingBundle {
  readonly prompt: string;
  readonly memory: readonly string[];
  readonly knowledge: readonly string[];
}

export interface BundleChange {
  readonly surface: ChangeSurface;
  readonly summary: string;
  readonly diff: string;
}

export interface ProductionAgentMessage {
  readonly messageId: string;
  readonly text: string;
}

export interface ProductionToolCall {
  readonly callId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly outputSummary?: string;
  readonly status: ProductionToolCallStatus;
}

export interface ProductionUserCorrection {
  readonly correctionId: string;
  readonly summary: string;
}

export interface ProductionSignals {
  readonly retryCount: number;
  readonly interrupted: boolean;
  readonly stuck: boolean;
  readonly humanTakeover: boolean;
}

export interface ProductionOutcome {
  readonly status: ProductionTerminalOutcome;
  readonly summary: string;
}

export interface ProductionTraceInput {
  readonly capturedAt: string;
  readonly bundleVersionId: string;
  readonly userRequest: string;
  readonly agentMessages: readonly ProductionAgentMessage[];
  readonly toolCalls: readonly ProductionToolCall[];
  readonly userCorrections: readonly ProductionUserCorrection[];
  readonly signals: ProductionSignals;
  readonly terminalOutcome: ProductionOutcome;
}

export interface ProductionTraceRecord extends ProductionTraceInput {
  readonly traceId: string;
  readonly replayEvents: readonly RunEvent[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface ProductionLearningRecord {
  readonly learningRecordId: string;
  readonly traceId: string;
  readonly createdAt: string;
  readonly issueClass: "recovery" | "robustness" | "tool_use" | "observability";
  readonly evidenceAnchors: readonly EvidenceAnchor[];
  readonly rootCauseHypothesis: string;
  readonly recoveryBehavior: string;
  readonly userCorrectionSummary?: string;
  readonly recommendedChangeType: AutoPromotableChangeSurface;
}

export interface EvalCaseArtifact {
  readonly artifactId: string;
  readonly artifactType: EvalArtifactType;
  readonly createdAt: string;
  readonly sourceTraceId?: string;
  readonly sourceLearningRecordIds: readonly string[];
  readonly regressionTags: readonly string[];
  readonly successPredicate: string;
  readonly safetyPredicate: string;
  readonly replayEvents?: readonly RunEvent[];
}

export interface EvalArtifactExecutionResult {
  readonly executionId: string;
  readonly artifactId: string;
  readonly executedAt: string;
  readonly passed: boolean;
  readonly summary: string;
}

export interface EvalArtifactExecutionPlan {
  readonly executionId: string;
  readonly artifactId: string;
  readonly runId: string;
  readonly scenarioId: string;
  readonly scenarioType: "workflow";
  readonly replayEvents: readonly RunEvent[];
}

export interface CandidateValidationResult {
  readonly validationId: string;
  readonly candidateId: string;
  readonly validatedAt: string;
  readonly allNewEvalCasesPass: boolean;
  readonly safetyRiskDelta: "none" | "increased";
  readonly evaluatedArtifactIds: readonly string[];
  readonly failedArtifactIds: readonly string[];
  readonly reasons: readonly string[];
}

export interface ImprovementCandidate {
  readonly candidateId: string;
  readonly createdAt: string;
  readonly status: ImprovementCandidateStatus;
  readonly rationale: string;
  readonly linkedLearningRecordIds: readonly string[];
  readonly linkedEvalArtifactIds: readonly string[];
  readonly approvalRequired: boolean;
  readonly changes: readonly BundleChange[];
  readonly validationResult?: CandidateValidationResult;
}

export interface ServingBundleVersion {
  readonly bundleVersionId: string;
  readonly versionNumber: number;
  readonly createdAt: string;
  readonly status: ServingBundleStatus;
  readonly bundle: ServingBundle;
  readonly changes: readonly BundleChange[];
  readonly sourceCandidateId?: string;
  readonly parentBundleVersionId?: string;
  readonly previousActiveBundleVersionId?: string;
}

export interface PromotionDecision {
  readonly decisionId: string;
  readonly candidateId: string;
  readonly decidedAt: string;
  readonly outcome: PromotionDecisionOutcome;
  readonly reasons: readonly string[];
  readonly activeBundleVersionId: string;
  readonly previousActiveBundleVersionId?: string;
  readonly promotedBundleVersionId?: string;
}

export interface RollbackEvent {
  readonly rollbackEventId: string;
  readonly rolledBackAt: string;
  readonly reason: string;
  readonly triggeredBy: RollbackTrigger;
  readonly restoredBundleVersionId: string;
  readonly replacedBundleVersionId: string;
}

export interface MetricSnapshot {
  readonly snapshotId: string;
  readonly bundleVersionId: string;
  readonly capturedAt: string;
  readonly totalRuns: number;
  readonly successRate: number;
  readonly userCorrectionRate: number;
  readonly humanTakeoverRate: number;
  readonly interruptedRate: number;
  readonly retryPerRun: number;
  readonly stuckRate: number;
}

export interface MetricComparison {
  readonly comparisonId: string;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly comparedAt: string;
  readonly successRateDelta: number;
  readonly userCorrectionRateDelta: number;
  readonly humanTakeoverRateDelta: number;
  readonly interruptedRateDelta: number;
  readonly retryPerRunDelta: number;
  readonly stuckRateDelta: number;
}

export interface GuardrailEvaluation {
  readonly evaluationId: string;
  readonly activeBundleVersionId: string;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly evaluatedAt: string;
  readonly regressions: readonly string[];
  readonly shouldRollback: boolean;
  readonly triggeredRollbackEventId?: string;
}

export function isAutoPromotableChangeSurface(
  surface: ChangeSurface
): surface is AutoPromotableChangeSurface {
  return autoPromotableChangeSurfaces.includes(surface as AutoPromotableChangeSurface);
}

export function candidateTouchesApprovalRequiredSurface(
  candidate: Pick<ImprovementCandidate, "changes">
): boolean {
  return candidate.changes.some(
    (change) => !isAutoPromotableChangeSurface(change.surface)
  );
}
