import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AnalysisComparisonKeys,
  CapabilityInsight,
  ConfidenceLevel,
  EvidenceAnchor,
  RunEvent,
  RunAnalysis,
  SuggestedChange
} from "./index.js";
import { failureClasses } from "./index.js";

describe("analysis contracts", () => {
  it("exports the expected analysis contract types", () => {
    expectTypeOf(failureClasses).toEqualTypeOf<
      readonly [
        "goal_understanding",
        "decomposition",
        "tool_use",
        "recovery",
        "safety",
        "observability",
        "robustness",
        "efficiency"
      ]
    >();

    expectTypeOf<CapabilityInsight>().toMatchTypeOf<{
      dimension: string;
      status: "strength" | "weakness" | "gap";
      summary: string;
      declaredLevel?: string;
      measuredLevel?: string;
      confidence: ConfidenceLevel;
    }>();

    expectTypeOf<EvidenceAnchor>().toMatchTypeOf<{
      eventType?: RunEvent["type"];
    }>();

    expectTypeOf<SuggestedChange>().toMatchTypeOf<{
      changeType: string;
      evidenceAnchors: readonly EvidenceAnchor[];
    }>();

    expectTypeOf<RunAnalysis>().toMatchTypeOf<{
      generatedAt: string;
      summary: string;
      confidence: ConfidenceLevel;
      capabilityInsights: readonly CapabilityInsight[];
      comparisonKeys: AnalysisComparisonKeys;
    }>();

    expectTypeOf<AnalysisComparisonKeys>().toMatchTypeOf<{
      suggestedChangeTypes: readonly SuggestedChange["changeType"][];
    }>();
  });

  it("exports the supported failure taxonomy in order", () => {
    expect(failureClasses).toEqual([
      "goal_understanding",
      "decomposition",
      "tool_use",
      "recovery",
      "safety",
      "observability",
      "robustness",
      "efficiency"
    ]);
  });

  it("models analysis artifacts with capability insights and comparison keys", () => {
    const evidenceAnchors: readonly EvidenceAnchor[] = [
      {
        anchorId: "run-0001:event:0",
        runId: "run-0001",
        eventType: "judge.update",
        eventIndex: 0,
        summary: "Tool command failed."
      }
    ];

    const capabilityInsights: readonly CapabilityInsight[] = [
      {
        dimension: "recovery",
        status: "weakness",
        summary: "The run did not recover after the tool failure.",
        declaredLevel: "high",
        measuredLevel: "low",
        confidence: "medium"
      }
    ];

    const suggestedChanges: readonly SuggestedChange[] = [
      {
        changeId: "change-1",
        title: "Improve retry handling",
        description: "Add explicit retry logic for transient tool failures.",
        changeType: "retry-handling",
        priority: 1,
        targetsFailurePatterns: ["pattern-1"],
        evidenceAnchors
      }
    ];

    const comparisonKeys: AnalysisComparisonKeys = {
      failureClasses: ["recovery"],
      affectedDimensions: ["recovery"],
      suggestedChangeTypes: ["retry-handling"]
    };

    const analysis: RunAnalysis = {
      reportVersion: "v1",
      runId: "run-0001",
      scenarioId: "scenario-1",
      generatedAt: "2026-03-30T09:05:00.000Z",
      summary: "The run revealed recovery weakness after a tool failure.",
      confidence: "medium",
      capabilityInsights,
      failurePatterns: [
        {
          patternId: "pattern-1",
          class: "recovery",
          subtype: "tool-failure-no-retry",
          summary: "The agent stopped after a transient tool failure.",
          evidenceAnchors
        }
      ],
      suggestedChanges,
      evidenceAnchors,
      comparisonKeys
    };

    expect(analysis.capabilityInsights[0]?.dimension).toBe("recovery");
    expect(analysis.capabilityInsights[0]?.status).toBe("weakness");
    expect(analysis.suggestedChanges[0]?.changeType).toBe("retry-handling");
    expect(analysis.generatedAt).toBe("2026-03-30T09:05:00.000Z");
    expect(analysis.summary).toContain("recovery weakness");
    expect(analysis.confidence).toBe("medium");
    expect(analysis.comparisonKeys).toEqual(comparisonKeys);
    expect(analysis.suggestedChanges[0]?.evidenceAnchors).toBe(evidenceAnchors);
    expect(analysis.failurePatterns[0]?.evidenceAnchors).toBe(evidenceAnchors);
  });
});
