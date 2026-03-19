import { describe, expect, it } from "vitest";
import { createTrialProfile } from "@openclaw/domain";

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
});
