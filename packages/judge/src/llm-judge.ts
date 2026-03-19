import type { JudgeResult } from "../../domain/src/judging.js";
import type { RunEvent } from "../../domain/src/events.js";
import type { ScenarioDefinition } from "../../domain/src/scenarios.js";

export interface LLMJudgeInput {
  readonly scenario: ScenarioDefinition;
  readonly events: readonly RunEvent[];
}

export interface LLMJudge {
  evaluate(input: LLMJudgeInput): Promise<JudgeResult>;
}
