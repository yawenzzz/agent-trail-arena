import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BuildProfileForm, createRunRequest, handleAllocationChange } from "./build-profile-form.js";
import { AllocationBar } from "./allocation-bar.js";
import { createDefaultAllocation, rebalanceAllocation, toDeclaredBuild } from "../lib/build-allocation.js";

describe("BuildProfileForm", () => {
  it("renders the control console and interactive allocation bars", () => {
    const markup = renderToStaticMarkup(<BuildProfileForm />);

    expect(markup).toContain("Runtime provider");
    expect(markup).toContain("OpenClaw");
    expect(markup).toContain("Codex");
    expect(markup).toContain("OpenClaw State");
    expect(markup).toContain("Load local agents");
    expect(markup).toContain("No local agents found");
    expect(markup).toContain("Start trial");
    expect(markup).toContain("disabled");
    expect(markup).toContain("100 pts budget");
    expect(markup).toContain("Advanced allocation");
    expect(markup).toContain("Build shape");
    expect(markup).toContain("Build summary");
    expect(markup).toContain("robustness-heavy");
    expect(markup).toContain('type="range"');
    expect(markup).toContain("Planning");
    expect(markup).toContain("Safety discipline");
    expect(markup).toContain("Efficiency");
    expect(markup).toContain("Cost awareness");
  });

  it("rebalances allocation state and maps submit payload from the current allocation", () => {
    const current = createDefaultAllocation();
    const next = handleAllocationChange(current, "planning", 40);
    const request = createRunRequest(next, "agent-v1", {
      kind: "provider-agent",
      provider: "openclaw",
      workspaceRoot: "/tmp/openclaw-state/workspace-agent-1",
      agentId: "agent-1"
    });

    expect(next).toEqual(rebalanceAllocation(current, "planning", 40));
    expect(next.planning).toBe(40);
    expect(Object.values(next).reduce((total, value) => total + value, 0)).toBe(100);
    expect(request).toEqual({
      agentVersion: "agent-v1",
      build: toDeclaredBuild(next),
      judgeConfigVersion: "judge-v1",
      seed: "seed-123",
      runtime: {
        kind: "provider-agent",
        provider: "openclaw",
        workspaceRoot: "/tmp/openclaw-state/workspace-agent-1",
        agentId: "agent-1"
      }
    });
  });
});

describe("AllocationBar", () => {
  it("renders a range control for allocation updates", () => {
    const markup = renderToStaticMarkup(
      <AllocationBar label="Planning" onChange={vi.fn()} value={10} />
    );

    expect(markup).toContain('aria-label="Planning"');
    expect(markup).toContain('type="range"');
    expect(markup).toContain("10 pts");
  });
});
