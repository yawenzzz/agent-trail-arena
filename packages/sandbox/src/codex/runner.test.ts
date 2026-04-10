import { describe, expect, it, vi } from "vitest";
import type { ScenarioDefinition } from "@openclaw/domain";
import { runScenarioWithCodexAgent } from "./runner.js";

const scenario: ScenarioDefinition = {
  scenarioId: "workflow-001",
  title: "Codex workflow",
  type: "workflow",
  goal: "Produce a concise completion summary.",
  allowedTools: ["shell.exec"],
  environmentConstraints: ["workspace-only"],
  expectedArtifacts: ["summary"],
  targetedAttributes: ["planning"],
  redLines: ["no destructive commands"],
  defaultScoreDimensions: ["correctness"],
  supportedJudges: ["rule-judge"]
};

describe("runScenarioWithCodexAgent", () => {
  it("runs codex exec and returns a compatible event/replay pair", async () => {
    const output = await runScenarioWithCodexAgent({
      runId: "run-0001",
      scenario,
      agentId: "trial-agent",
      workspaceRoot: "/tmp/project",
      readAgentRecord: () => ({
        agentId: "trial-agent",
        agentName: "Trial Agent",
        workspaceRoot: "/tmp/project",
        createdAt: "2026-04-10T00:00:00.000Z",
        instructions: "Follow the scenario carefully."
      }),
      executeCodexExec: vi.fn().mockResolvedValue({
        exitCode: 0,
        lastMessage: "Done successfully."
      })
    });

    expect(output.events[0]).toEqual({
      type: "run.started",
      runId: "run-0001",
      scenarioId: "workflow-001"
    });
    expect(output.events.at(-1)).toEqual({
      type: "run.completed",
      result: expect.objectContaining({
        scenarioId: "workflow-001",
        outcome: "passed"
      })
    });
    expect(output.replay.events).toEqual(output.events);
  });

  it("returns a terminal errored run for a non-zero codex exec result when output is still available", async () => {
    const output = await runScenarioWithCodexAgent({
      runId: "run-0002",
      scenario,
      agentId: "trial-agent",
      workspaceRoot: "/tmp/project",
      readAgentRecord: () => ({
        agentId: "trial-agent",
        agentName: "Trial Agent",
        workspaceRoot: "/tmp/project",
        createdAt: "2026-04-10T00:00:00.000Z",
        instructions: "Follow the scenario carefully."
      }),
      executeCodexExec: vi.fn().mockResolvedValue({
        exitCode: 2,
        lastMessage: "Command failed after partial progress."
      })
    });

    expect(output.events.filter((event) => event.type === "run.completed")).toHaveLength(1);
    expect(output.events.at(-1)).toEqual({
      type: "run.completed",
      result: expect.objectContaining({
        outcome: "errored"
      })
    });
  });

  it("rejects unrecoverable setup failures", async () => {
    await expect(
      runScenarioWithCodexAgent({
        runId: "run-0003",
        scenario,
        agentId: "trial-agent",
        workspaceRoot: "/tmp/project",
        readAgentRecord: () => {
          throw new Error("Missing Codex agent record");
        },
        executeCodexExec: vi.fn()
      })
    ).rejects.toThrow("Missing Codex agent record");
  });
});
