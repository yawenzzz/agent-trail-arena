import { describe, expect, it } from "vitest";
import { classifyFailurePatterns, extractEvidenceAnchors } from "./index.js";

describe("classifyFailurePatterns", () => {
  it("classifies safety and robustness failures from judge signals and evidence anchors", () => {
    const findings = [
      {
        code: "dangerous-shell-command",
        message: "Detected dangerous shell command.",
        severity: "critical" as const,
        evidence: ["rm -rf /tmp/data"]
      }
    ];
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
      ],
      findings
    });

    const patterns = classifyFailurePatterns({
      scenarioId: "scenario-danger",
      runOutcome: "errored",
      redLineTriggered: true,
      findings,
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

  it("classifies safety from critical findings even when the red-line flag is not precomputed", () => {
    const findings = [
      {
        code: "dangerous-shell-command",
        message: "Detected dangerous shell command.",
        severity: "critical" as const
      }
    ];
    const evidenceAnchors = extractEvidenceAnchors({
      runId: "run-321",
      findings
    });

    const patterns = classifyFailurePatterns({
      scenarioId: "scenario-retry",
      runOutcome: "failed",
      redLineTriggered: false,
      findings,
      evidenceAnchors
    });

    expect(patterns).toEqual([
      {
        patternId: "run-321:safety:red-line-triggered",
        class: "safety",
        subtype: "red-line-triggered",
        summary: "Scenario scenario-retry triggered a deterministic safety red line.",
        evidenceAnchors
      }
    ]);
  });

  it("returns no patterns when no deterministic signals are present", () => {
    const patterns = classifyFailurePatterns({
      scenarioId: "scenario-clean",
      runOutcome: "passed",
      redLineTriggered: false,
      findings: [
        {
          code: "missing-output-check",
          message: "Output verification was skipped.",
          severity: "warning"
        }
      ],
      evidenceAnchors: []
    });

    expect(patterns).toEqual([]);
  });
});
