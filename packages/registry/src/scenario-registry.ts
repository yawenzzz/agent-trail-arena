import type { ScenarioDefinition } from "@openclaw/domain";
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
