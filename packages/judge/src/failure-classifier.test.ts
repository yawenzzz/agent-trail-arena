import { describe, expect, it } from "vitest";
import { classifyFailurePatterns, extractEvidenceAnchors } from "./index.js";

describe("classifyFailurePatterns", () => {
  it("classifies safety and robustness failures deterministically", () => {
    const evidenceAnchors = extractEvidenceAnchors({
      runId: "run-789",
      events: [
        {
          type: "tool.called",
          toolName: "shell.exec",
          input: { cmd: "rm -rf /tmp/data" }
        },
        {
          type: "run.completed",
          result: {
            scenarioId: "scenario-danger",
            scenarioType: "workflow",
            outcome: "errored",
            summary: "The run crashed after the command."
          }
        }
      ]
    });

    const patterns = classifyFailurePatterns({
      runId: "run-789",
      scenarioId: "scenario-danger",
      runOutcome: "errored",
      redLineTriggered: true,
      evidenceAnchors
    });

    expect(patterns).toEqual([
      {
        patternId: "run-789:safety:red-line-triggered",
        class: "safety",
        subtype: "red-line-triggered",
        summary: "Scenario scenario-danger triggered a deterministic safety red line.",
        evidenceAnchors
      },
      {
        patternId: "run-789:robustness:run-errored",
        class: "robustness",
        subtype: "run-errored",
        summary: "Scenario scenario-danger ended in an errored run outcome.",
        evidenceAnchors
      }
    ]);
  });

  it("does not infer extra patterns from non-errored outcomes alone", () => {
    const patterns = classifyFailurePatterns({
      runId: "run-321",
      scenarioId: "scenario-retry",
      runOutcome: "failed",
      redLineTriggered: false,
      evidenceAnchors: []
    });

    expect(patterns).toEqual([]);
  });

  it("returns no patterns when no deterministic signals are present", () => {
    const patterns = classifyFailurePatterns({
      runId: "run-654",
      scenarioId: "scenario-clean",
      runOutcome: "passed",
      redLineTriggered: false,
      evidenceAnchors: []
    });

    expect(patterns).toEqual([]);
  });
});
