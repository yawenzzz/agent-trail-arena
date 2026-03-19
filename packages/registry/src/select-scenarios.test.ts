import { describe, expect, it } from "vitest";
import { createTrialProfile } from "@openclaw/domain";
import { scenarioRegistry } from "./scenario-registry.js";
import { selectScenarios } from "./select-scenarios.js";

function fixtureProfile(
  build: Parameters<typeof createTrialProfile>[0]["build"],
  seed = "seed-123"
) {
  return createTrialProfile({
    agentVersion: "agent-v1",
    build,
    scenarioRegistryVersion: scenarioRegistry.version,
    judgeConfigVersion: "v1",
    seed
  });
}

describe("selectScenarios", () => {
  it("selects both standard and workflow scenarios for a robustness-heavy build", () => {
    const scenarios = selectScenarios({
      profile: fixtureProfile({ robustness: "high", safetyDiscipline: "high" }),
      registry: scenarioRegistry,
      limit: 4
    });

    expect(scenarios.some((item) => item.type === "standard")).toBe(true);
    expect(scenarios.some((item) => item.type === "workflow")).toBe(true);
    expect(scenarios.some((item) => item.targetedAttributes.includes("robustness"))).toBe(
      true
    );
  });

  it("keeps scenario ordering stable for the same seed and profile", () => {
    const input = {
      profile: fixtureProfile({ robustness: "high", planning: "medium" }),
      registry: scenarioRegistry,
      limit: 4
    } as const;

    const first = selectScenarios(input).map((item) => item.scenarioId);
    const second = selectScenarios(input).map((item) => item.scenarioId);

    expect(second).toEqual(first);
  });

  it("keeps ordering stable for the same declared build and seed across version changes", () => {
    const baseBuild = {};
    const shared = {
      build: baseBuild,
      scenarioRegistryVersion: scenarioRegistry.version,
      seed: "seed-123"
    } as const;

    const first = selectScenarios({
      profile: createTrialProfile({
        ...shared,
        agentVersion: "agent-v1",
        judgeConfigVersion: "judge-v1"
      }),
      registry: scenarioRegistry,
      limit: 4
    }).map((item) => item.scenarioId);

    const second = selectScenarios({
      profile: createTrialProfile({
        ...shared,
        agentVersion: "agent-v2",
        judgeConfigVersion: "judge-v2"
      }),
      registry: scenarioRegistry,
      limit: 4
    }).map((item) => item.scenarioId);

    expect(second).toEqual(first);
  });

  it("rejects profiles built against a different scenario registry version", () => {
    expect(() =>
      selectScenarios({
        profile: createTrialProfile({
          agentVersion: "agent-v1",
          build: { robustness: "high" },
          scenarioRegistryVersion: "2026-03-18",
          judgeConfigVersion: "judge-v1",
          seed: "seed-123"
        }),
        registry: scenarioRegistry,
        limit: 4
      })
    ).toThrow("scenarioRegistryVersion mismatch");
  });
});
