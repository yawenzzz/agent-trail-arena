import type { ScenarioDefinition } from "../../domain/src/scenarios.js";
import { standardScenarios } from "./scenarios/standard.js";
import { workflowScenarios } from "./scenarios/workflow.js";

export interface ScenarioRegistry {
  readonly version: string;
  readonly scenarios: readonly ScenarioDefinition[];
}

export const scenarioRegistry = {
  version: "2026-03-19",
  scenarios: [...standardScenarios, ...workflowScenarios]
} as const satisfies ScenarioRegistry;
