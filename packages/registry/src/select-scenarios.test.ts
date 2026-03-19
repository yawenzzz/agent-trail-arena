import { describe, expect, it } from "vitest";
import { createTrialProfile } from "../../domain/src/builds.js";
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
});
