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
  });
});
