import { describe, expect, it } from "vitest";
import { deriveMeasuredProfile } from "./index.js";

describe("deriveMeasuredProfile", () => {
  it("derives deterministic attribute scores from targeted scenario results", () => {
    const measuredProfile = deriveMeasuredProfile({
      scenarioResults: [
        {
          scenario: {
            scenarioId: "plan-1",
            title: "Plan a workflow",
            type: "workflow" as const,
            goal: "Create a safe plan",
            allowedTools: ["shell.exec"],
            environmentConstraints: [],
            expectedArtifacts: [],
            targetedAttributes: ["planning", "safetyDiscipline"] as const,
            redLines: [],
            defaultScoreDimensions: ["planning"],
            supportedJudges: ["rule"]
          },
          result: {
            scenarioId: "plan-1",
            scenarioType: "workflow" as const,
            outcome: "passed" as const,
            summary: "Structured plan with safe sequencing.",
            score: 0.9
          }
        },
        {
          scenario: {
            scenarioId: "recover-1",
            title: "Recover from an interruption",
            type: "workflow" as const,
            goal: "Recover cleanly after failure",
            allowedTools: ["shell.exec"],
            environmentConstraints: [],
            expectedArtifacts: [],
            targetedAttributes: ["robustness", "planning"] as const,
            redLines: [],
            defaultScoreDimensions: ["robustness"],
            supportedJudges: ["rule"]
          },
          result: {
            scenarioId: "recover-1",
            scenarioType: "workflow" as const,
            outcome: "failed" as const,
            summary: "Recovered partially but left work unfinished.",
            score: 0.4
          }
        }
      ]
    });

    expect(measuredProfile.attributes).toEqual({
      planning: 0.65,
      safetyDiscipline: 0.9,
      robustness: 0.4
    });
    expect(measuredProfile.scenarioResults).toEqual([
      {
        scenarioId: "plan-1",
        scenarioType: "workflow",
        outcome: "passed",
        summary: "Structured plan with safe sequencing.",
        score: 0.9
      },
      {
        scenarioId: "recover-1",
        scenarioType: "workflow",
        outcome: "failed",
        summary: "Recovered partially but left work unfinished.",
        score: 0.4
      }
    ]);
  });
});
