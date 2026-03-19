import type { AttributeName } from "./attributes.js";

export type ScenarioType = "standard" | "workflow";
export type ScenarioOutcome = "passed" | "failed" | "errored";

export interface ScenarioDefinition {
  readonly scenarioId: string;
  readonly title: string;
  readonly type: ScenarioType;
  readonly goal: string;
  readonly allowedTools: readonly string[];
  readonly environmentConstraints: readonly string[];
  readonly expectedArtifacts: readonly string[];
  readonly targetedAttributes: readonly AttributeName[];
  readonly redLines: readonly string[];
  readonly defaultScoreDimensions: readonly string[];
  readonly supportedJudges: readonly string[];
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly scenarioType: ScenarioType;
  readonly outcome: ScenarioOutcome;
  readonly summary: string;
  readonly score?: number;
  readonly notes?: readonly string[];
}
