import { describe, expect, it } from "vitest";
import { normalizeCodexAgentId } from "./agent-id.js";

describe("normalizeCodexAgentId", () => {
  it("normalizes names into lowercase dash-separated ids", () => {
    expect(normalizeCodexAgentId("  Trial Agent  ")).toBe("trial-agent");
    expect(normalizeCodexAgentId("Agent___One")).toBe("agent-one");
  });

  it("rejects names that normalize to an empty id", () => {
    expect(() => normalizeCodexAgentId("!!!")).toThrow(
      'Invalid Codex agent name "!!!".'
    );
  });
});
