import type { RunEvent } from "./events.js";

export const failureClasses = [
  "goal_understanding",
  "decomposition",
  "tool_use",
  "recovery",
  "safety",
  "observability",
  "robustness",
  "efficiency"
] as const;

export type FailureClass = (typeof failureClasses)[number];
export type ConfidenceLevel = "low" | "medium" | "high";

export interface EvidenceAnchor {
  readonly anchorId: string;
  readonly runId: string;
  readonly eventType?: RunEvent["type"];
  readonly eventIndex?: number;
  readonly replayTimestampMs?: number;
  readonly summary: string;
}

export interface CapabilityInsight {
  readonly dimension: string;
  readonly status: "strength" | "weakness" | "gap";
  readonly summary: string;
  readonly declaredLevel?: string;
  readonly measuredLevel?: string;
  readonly confidence: ConfidenceLevel;
}

export interface FailurePattern {
  readonly patternId: string;
  readonly class: FailureClass;
  readonly subtype: string;
  readonly summary: string;
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface SuggestedChange {
  readonly changeId: string;
  readonly title: string;
  readonly description: string;
  readonly changeType: string;
  readonly priority: 1 | 2 | 3;
  readonly targetsFailurePatterns: readonly string[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface AnalysisComparisonKeys {
  readonly failureClasses: readonly FailureClass[];
  readonly affectedDimensions: readonly string[];
  readonly suggestedChangeTypes: readonly SuggestedChange["changeType"][];
}

export interface RunAnalysis {
  readonly reportVersion: "v1";
  readonly runId: string;
  readonly scenarioId: string;
  readonly generatedAt: string;
  readonly summary: string;
  readonly confidence: ConfidenceLevel;
  readonly capabilityInsights: readonly CapabilityInsight[];
  readonly failurePatterns: readonly FailurePattern[];
  readonly suggestedChanges: readonly SuggestedChange[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
  readonly comparisonKeys: AnalysisComparisonKeys;
}
