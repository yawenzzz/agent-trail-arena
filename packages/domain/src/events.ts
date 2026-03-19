import type { ScenarioResult } from "./scenarios.js";

export type RunEvent =
  | { type: "run.started"; runId: string; scenarioId: string }
  | { type: "agent.summary"; text: string }
  | { type: "tool.called"; toolName: string; input: unknown }
  | { type: "judge.update"; summary: string }
  | { type: "run.completed"; result: ScenarioResult };
