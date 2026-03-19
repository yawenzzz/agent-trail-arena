import { attributeNames } from "../../domain/src/attributes.js";
import type { MeasuredProfile } from "../../domain/src/judging.js";
import type { ScenarioDefinition, ScenarioResult } from "../../domain/src/scenarios.js";

export interface AggregationScenarioResult {
  readonly scenario: ScenarioDefinition;
  readonly result: ScenarioResult;
}

export interface AggregationInput {
  readonly scenarioResults: readonly AggregationScenarioResult[];
}

export function deriveMeasuredProfile(input: AggregationInput): MeasuredProfile {
  const totals = new Map<string, { total: number; count: number }>();

  for (const scenarioResult of input.scenarioResults) {
    const score = normalizeScenarioScore(scenarioResult.result);

    for (const attribute of scenarioResult.scenario.targetedAttributes) {
      const current = totals.get(attribute) ?? { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      totals.set(attribute, current);
    }
  }

  const attributes = Object.fromEntries(
    attributeNames.flatMap((attribute) => {
      const current = totals.get(attribute);

      if (!current) {
        return [];
      }

      return [[attribute, roundToTwoDecimals(current.total / current.count)]];
    })
  );

  return {
    attributes,
    scenarioResults: input.scenarioResults.map((entry) => ({ ...entry.result }))
  };
}

function normalizeScenarioScore(result: ScenarioResult): number {
  if (typeof result.score === "number") {
    return clamp(result.score, 0, 1);
  }

  switch (result.outcome) {
    case "passed":
      return 1;
    case "failed":
    case "errored":
      return 0;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}
