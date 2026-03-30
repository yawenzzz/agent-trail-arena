import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AuthorizationScope,
  BlockingIssue,
  ConfidenceLevel,
  EvidenceAnchor,
  GradeAssessment,
  PromotionGap
} from "./index.js";
import { agentGrades } from "./index.js";

describe("grade contracts", () => {
  it("exports the expected grade contract types", () => {
    expectTypeOf(agentGrades).toEqualTypeOf<
      readonly ["Intern", "Junior", "Mid", "Senior", "Lead"]
    >();

    expectTypeOf<AuthorizationScope>().toMatchTypeOf<{
      scopeId: string;
      summary: string;
      allowedWork: readonly string[];
      blockedWork: readonly string[];
      evidenceAnchors: readonly EvidenceAnchor[];
    }>();

    expectTypeOf<PromotionGap>().toMatchTypeOf<{
      targetGrade: "Intern" | "Junior" | "Mid" | "Senior" | "Lead";
    }>();

    expectTypeOf<BlockingIssue>().toMatchTypeOf<{
      maxAllowedGrade: "Intern" | "Junior" | "Mid" | "Senior" | "Lead";
    }>();

    expectTypeOf<GradeAssessment>().toMatchTypeOf<{
      recommendedGrade: "Intern" | "Junior" | "Mid" | "Senior" | "Lead";
      gradeConfidence: ConfidenceLevel;
      authorizedScope: readonly AuthorizationScope[];
      restrictedScope: readonly AuthorizationScope[];
      promotionGaps: readonly PromotionGap[];
      blockingIssues: readonly BlockingIssue[];
      supportingEvidence: readonly EvidenceAnchor[];
    }>();
  });

  it("exports the common grade ladder in order", () => {
    expect(agentGrades).toEqual(["Intern", "Junior", "Mid", "Senior", "Lead"]);
  });

  it("models authorization scope and grade assessment artifacts", () => {
    const evidenceAnchors: readonly EvidenceAnchor[] = [
      {
        anchorId: "run-0001:event:0",
        runId: "run-0001",
        eventType: "judge.update",
        eventIndex: 0,
        summary: "The run ended after a recovery failure."
      }
    ];

    const authorizedScope: readonly AuthorizationScope[] = [
      {
        scopeId: "scope-1",
        summary: "Low-risk standard tasks are permitted.",
        allowedWork: ["standard tasks"],
        blockedWork: ["high-risk autonomous work"],
        evidenceAnchors
      }
    ];

    const restrictedScope: readonly AuthorizationScope[] = [
      {
        scopeId: "scope-2",
        summary: "Ambiguous multi-step work remains restricted.",
        allowedWork: ["single-step tasks"],
        blockedWork: ["multi-step delegation"],
        evidenceAnchors
      }
    ];

    const promotionGaps: readonly PromotionGap[] = [
      {
        gapId: "gap-1",
        title: "Recovery must improve before promotion",
        description: "The agent needs stronger recovery behavior to reach Mid.",
        targetGrade: "Mid",
        evidenceAnchors
      }
    ];

    const blockingIssues: readonly BlockingIssue[] = [
      {
        issueId: "issue-1",
        title: "Weak recovery blocks higher autonomy",
        description: "The current run does not support Senior-level autonomy.",
        maxAllowedGrade: "Junior",
        evidenceAnchors
      }
    ];

    const assessment: GradeAssessment = {
      assessmentVersion: "v1",
      runId: "run-0001",
      scenarioId: "scenario-1",
      recommendedGrade: "Junior",
      gradeConfidence: "medium",
      authorizedScope,
      restrictedScope,
      promotionGaps,
      blockingIssues,
      supportingEvidence: evidenceAnchors
    };

    expect(assessment.recommendedGrade).toBe("Junior");
    expect(assessment.gradeConfidence).toBe("medium");
    expect(assessment.authorizedScope).toEqual(authorizedScope);
    expect(assessment.restrictedScope).toEqual(restrictedScope);
    expect(assessment.promotionGaps[0]?.targetGrade).toBe("Mid");
    expect(assessment.blockingIssues[0]?.maxAllowedGrade).toBe("Junior");
    expect(assessment.supportingEvidence).toBe(evidenceAnchors);
  });
});
