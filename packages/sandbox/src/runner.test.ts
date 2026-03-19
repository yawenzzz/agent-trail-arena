import { describe, expect, it } from "vitest";
import type { RunEvent } from "@openclaw/domain";
import { runScenarioWithScriptedAgent } from "./runner.js";
import { streamScenarioWithScriptedAgent } from "./runner.js";

function fixtureScenario() {
  return {
    runId: "run-123",
    scenarioId: "scenario-abc",
    scenarioType: "workflow" as const,
    agentName: "cautiousPlanner" as const
  };
}

function eventOfType<T extends RunEvent["type"]>(
  events: readonly RunEvent[],
  type: T
): Extract<RunEvent, { type: T }> {
  const event = events.find((item): item is Extract<RunEvent, { type: T }> => item.type === type);

  if (!event) {
    throw new Error(`Missing event: ${type}`);
  }

  return event;
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
    expect(eventOfType(output.events, "run.completed").result.scenarioType).toBe(
      "workflow"
    );
    expect(output.replay.events).toHaveLength(output.events.length);
  });

  it("isolates streamed events, replay snapshots, and future runs", async () => {
    const streamedEvents = [];
    for await (const event of streamScenarioWithScriptedAgent(fixtureScenario())) {
      streamedEvents.push(event);
    }

    expect(streamedEvents.map((event) => event.type)).toEqual([
      "run.started",
      "agent.summary",
      "tool.called",
      "judge.update",
      "run.completed"
    ]);
    expect(eventOfType(streamedEvents, "run.completed").result.scenarioType).toBe(
      "workflow"
    );

    const firstRun = await runScenarioWithScriptedAgent(fixtureScenario());
    const firstReplaySnapshot = structuredClone(firstRun.replay.events);

    const summaryEvent = eventOfType(firstRun.events, "agent.summary");
    const toolEvent = eventOfType(firstRun.events, "tool.called");
    const judgeEvent = eventOfType(firstRun.events, "judge.update");

    summaryEvent.text = "mutated summary";
    toolEvent.input = { path: "MUTATED.md" };
    judgeEvent.summary = "mutated judge";

    expect(firstRun.replay.events).toEqual(firstReplaySnapshot);
    expect(eventOfType(firstRun.replay.events, "agent.summary").text).toBe(
      "Break the task into safe steps."
    );
    expect(eventOfType(firstRun.replay.events, "tool.called").input).toEqual({
      path: "README.md"
    });

    const secondRun = await runScenarioWithScriptedAgent(fixtureScenario());

    expect(eventOfType(secondRun.events, "agent.summary").text).toBe(
      "Break the task into safe steps."
    );
    expect(eventOfType(secondRun.events, "tool.called").input).toEqual({
      path: "README.md"
    });
    expect(eventOfType(secondRun.replay.events, "agent.summary").text).toBe(
      "Break the task into safe steps."
    );
    expect(eventOfType(secondRun.replay.events, "tool.called").input).toEqual({
      path: "README.md"
    });
  });
});
