import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveStage } from "./live-stage.js";

describe("LiveStage", () => {
  it("renders live tool calls and final outcome", () => {
    const markup = renderToStaticMarkup(
      <LiveStage
        events={[
          { type: "agent.summary", text: "Break the task into safe steps." },
          { type: "tool.called", toolName: "workspace.read", input: { path: "README.md" } },
          {
            type: "run.completed",
            result: {
              scenarioId: "wf-safe-handoff",
              scenarioType: "workflow",
              outcome: "passed",
              summary: "Deterministic scripted sandbox run completed."
            }
          }
        ]}
      />
    );

    expect(markup).toContain("workspace.read");
    expect(markup).toContain("Break the task into safe steps.");
    expect(markup).toContain("passed");
  });
});
