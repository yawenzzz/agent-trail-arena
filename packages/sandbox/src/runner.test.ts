import { describe, expect, it } from "vitest";
import { runScenarioWithScriptedAgent } from "./runner.js";

function fixtureScenario() {
  return {
    runId: "run-123",
    scenarioId: "scenario-abc",
    agentName: "cautiousPlanner" as const
  };
}

describe("runScenarioWithScriptedAgent", () => {
  it("streams ordered events and captures a replay log", async () => {
    const output = await runScenarioWithScriptedAgent(fixtureScenario());

    expect(output.events.map((event) => event.type)).toEqual([
      "run.started",
      "agent.summary",
      "tool.called",
      "judge.update",
      "run.completed"
    ]);
    expect(output.replay.events).toHaveLength(output.events.length);
  });
});
