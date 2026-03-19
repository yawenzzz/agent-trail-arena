import { describe, expect, it } from "vitest";
import { createTrialProfile, type DeclaredBuild } from "@openclaw/domain";

describe("createTrialProfile", () => {
  it("serializes a trial profile deterministically", () => {
    const profile = createTrialProfile({
      agentVersion: "agent-v1",
      build: { planning: "high", robustness: "high", efficiency: "medium" },
      scenarioRegistryVersion: "2026-03-19",
      judgeConfigVersion: "v1",
      seed: "seed-123"
    });

    expect(profile.profileId).toBe("agent-v1:2026-03-19:v1:seed-123");
    expect(profile.buildSignature).toBe(
      "planning=high,efficiency=medium,robustness=high"
    );
    expect(profile.buildEntries).toEqual([
      { attribute: "planning", level: "high" },
      { attribute: "efficiency", level: "medium" },
      { attribute: "robustness", level: "high" }
    ]);
  });

  it("snapshots the declared build so later caller mutations do not leak into the profile", () => {
    const build: DeclaredBuild = {
      planning: "high",
      robustness: "high",
      efficiency: "medium"
    };

    const profile = createTrialProfile({
      agentVersion: "agent-v1",
      build,
      scenarioRegistryVersion: "2026-03-19",
      judgeConfigVersion: "v1",
      seed: "seed-123"
    });

    build.planning = "low";
    delete build.robustness;

    expect(profile.build).toEqual({
      planning: "high",
      robustness: "high",
      efficiency: "medium"
    });
    expect(profile.buildSignature).toBe(
      "planning=high,efficiency=medium,robustness=high"
    );
    expect(profile.buildEntries).toEqual([
      { attribute: "planning", level: "high" },
      { attribute: "efficiency", level: "medium" },
      { attribute: "robustness", level: "high" }
    ]);
  });
});
