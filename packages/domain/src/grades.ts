import type { EvidenceAnchor } from "./analysis.js";
import type { ConfidenceLevel } from "./analysis.js";

export const agentGrades = ["Intern", "Junior", "Mid", "Senior", "Lead"] as const;

export type AgentGrade = (typeof agentGrades)[number];

export interface AuthorizationScope {
  readonly scopeId: string;
  readonly summary: string;
  readonly allowedWork: readonly string[];
  readonly blockedWork: readonly string[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface PromotionGap {
  readonly gapId: string;
  readonly title: string;
  readonly description: string;
  readonly targetGrade: AgentGrade;
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface BlockingIssue {
  readonly issueId: string;
  readonly title: string;
  readonly description: string;
  readonly maxAllowedGrade: AgentGrade;
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export interface GradeAssessment {
  readonly assessmentVersion: "v1";
  readonly runId: string;
  readonly scenarioId: string;
  readonly recommendedGrade: AgentGrade;
  readonly gradeConfidence: ConfidenceLevel;
  readonly authorizedScope: readonly AuthorizationScope[];
  readonly restrictedScope: readonly AuthorizationScope[];
  readonly promotionGaps: readonly PromotionGap[];
  readonly blockingIssues: readonly BlockingIssue[];
  readonly supportingEvidence: readonly EvidenceAnchor[];
}
