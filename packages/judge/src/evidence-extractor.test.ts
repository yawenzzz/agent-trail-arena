import { describe, expect, it } from "vitest";
import { extractEvidenceAnchors } from "./index.js";

describe("extractEvidenceAnchors", () => {
  it("builds stable anchor ids and summaries from run events", () => {
    const anchors = extractEvidenceAnchors({
      runId: "run-123",
      events: [
        {
          type: "run.started",
          runId: "run-123",
          scenarioId: "scenario-alpha"
        },
        {
          type: "tool.called",
          toolName: "shell.exec",
          input: { cmd: "ls -la" }
        },
        {
          type: "judge.update",
          summary: "Observed command output."
        },
        {
          type: "run.completed",
          result: {
            scenarioId: "scenario-alpha",
            scenarioType: "workflow",
            outcome: "passed",
            summary: "Completed successfully."
          }
        }
      ]
    });

    expect(anchors).toEqual([
      {
        anchorId: "run-123:event:0",
        runId: "run-123",
        eventType: "run.started",
        eventIndex: 0,
        summary: "Run started for scenario scenario-alpha."
      },
      {
        anchorId: "run-123:event:1",
        runId: "run-123",
        eventType: "tool.called",
        eventIndex: 1,
        summary: "Tool shell.exec called with command: ls -la."
      },
      {
        anchorId: "run-123:event:2",
        runId: "run-123",
        eventType: "judge.update",
        eventIndex: 2,
        summary: "Judge update: Observed command output."
      },
      {
        anchorId: "run-123:event:3",
        runId: "run-123",
        eventType: "run.completed",
        eventIndex: 3,
        summary: "Run completed with outcome passed."
      }
    ]);
  });

  it("falls back to generic summaries when event details are unavailable", () => {
    const anchors = extractEvidenceAnchors({
      runId: "run-456",
      events: [
        {
          type: "agent.summary",
          text: "Need to inspect the logs."
        },
        {
          type: "tool.called",
          toolName: "shell.exec",
          input: { args: ["pwd"] }
        }
      ]
    });

    expect(anchors).toEqual([
      {
        anchorId: "run-456:event:0",
        runId: "run-456",
        eventType: "agent.summary",
        eventIndex: 0,
        summary: "Agent summary: Need to inspect the logs."
      },
      {
        anchorId: "run-456:event:1",
        runId: "run-456",
        eventType: "tool.called",
        eventIndex: 1,
        summary: "Tool shell.exec called."
      }
    ]);
  });
});
