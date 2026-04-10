import { describe, expect, it } from "vitest";
import { resetProviderFormStateForSwitch } from "./provider-form-state.js";

describe("resetProviderFormStateForSwitch", () => {
  it("clears incompatible provider context, agents, selection, and provider-specific errors", () => {
    expect(
      resetProviderFormStateForSwitch({
        nextProvider: "codex",
        state: {
          provider: "openclaw",
          stateRoot: "/tmp/openclaw-state",
          workspaceRoot: "/tmp/project",
          agents: [
            {
              provider: "openclaw",
              agentId: "agent-1",
              agentName: "main",
              definitionPath: "/tmp/openclaw-state/openclaw.json",
              workspaceRoot: "/tmp/openclaw-state/workspace-main"
            }
          ],
          selectedAgentId: "agent-1",
          workspaceError: "OpenClaw failed"
        }
      })
    ).toEqual({
      provider: "codex",
      stateRoot: "",
      workspaceRoot: "/tmp/project",
      agents: [],
      selectedAgentId: "",
      workspaceError: null
    });
  });
});
