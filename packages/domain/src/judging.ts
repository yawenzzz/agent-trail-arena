import type { AttributeName } from "./attributes.js";
import type { ScenarioResult } from "./scenarios.js";

export type JudgeSeverity = "info" | "warning" | "critical";

export interface JudgeFinding {
  readonly code: string;
  readonly message: string;
  readonly severity: JudgeSeverity;
  readonly evidence?: readonly string[];
}

export interface JudgeResult {
  readonly summary: string;
  readonly findings: readonly JudgeFinding[];
  readonly redLineTriggered: boolean;
}

export interface MeasuredProfile {
  readonly attributes: Partial<Record<AttributeName, number>>;
  readonly scenarioResults: readonly ScenarioResult[];
}
