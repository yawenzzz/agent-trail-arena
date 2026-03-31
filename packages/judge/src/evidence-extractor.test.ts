import { describe, expect, it } from "vitest";
import { extractEvidenceAnchors } from "./index.js";

describe("extractEvidenceAnchors", () => {
  it("builds stable anchor ids and summaries across event replay and finding sources", () => {
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
      ],
      replayEvents: [
        {
          type: "agent.summary",
          text: "Replaying prior reasoning."
        },
        {
          type: "tool.called",
          toolName: "shell.exec",
          input: { cmd: "pwd" }
        }
      ],
      findings: [
        {
          code: "dangerous-shell-command",
          message: "Detected dangerous shell command.",
          severity: "critical",
          evidence: ["rm -rf /tmp/data"]
        },
        {
          code: "missing-output-check",
          message: "The run completed without verifying output.",
          severity: "warning"
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
      },
      {
        anchorId: "run-123:replay:0",
        runId: "run-123",
        eventType: "agent.summary",
        eventIndex: 0,
        summary: "Replay event: Agent summary: Replaying prior reasoning."
      },
      {
        anchorId: "run-123:replay:1",
        runId: "run-123",
        eventType: "tool.called",
        eventIndex: 1,
        summary: "Replay event: Tool shell.exec called with command: pwd."
      },
      {
        anchorId: "run-123:finding:0",
        runId: "run-123",
        summary: "Judge finding dangerous-shell-command (critical): Detected dangerous shell command."
      },
      {
        anchorId: "run-123:finding:1",
        runId: "run-123",
        summary: "Judge finding missing-output-check (warning): The run completed without verifying output."
      }
    ]);
  });

  it("falls back to generic summaries when event or finding details are unavailable", () => {
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
      ],
      findings: [
        {
          code: "generic-warning",
          message: "Generic warning.",
          severity: "warning",
          evidence: []
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
      },
      {
        anchorId: "run-456:finding:0",
        runId: "run-456",
        summary: "Judge finding generic-warning (warning): Generic warning."
      }
    ]);
  });
});
