import type { TrialProfile } from "@openclaw/domain";
import type { ScenarioDefinition } from "@openclaw/domain";
import type { ScenarioRegistry } from "./scenario-registry.js";

export interface SelectScenarioInput {
  readonly profile: TrialProfile;
  readonly registry: ScenarioRegistry;
  readonly limit: number;
}

const levelWeights = {
  low: 1,
  medium: 2,
  high: 3
} as const;

function scoreScenario(
  scenario: ScenarioDefinition,
  profile: TrialProfile
): number {
  const buildWeights = new Map(
    profile.buildEntries.map(({ attribute, level }) => [
      attribute,
      levelWeights[level]
    ])
  );

  return scenario.targetedAttributes.reduce(
    (score, attribute) => score + (buildWeights.get(attribute) ?? 0),
    0
  );
}

function hashSeed(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function assertRegistryVersionMatches(
  profile: TrialProfile,
  registry: ScenarioRegistry
): void {
  if (profile.scenarioRegistryVersion !== registry.version) {
    throw new Error(
      `scenarioRegistryVersion mismatch: profile=${profile.scenarioRegistryVersion} registry=${registry.version}`
    );
  }
}

export function rankScenarios(
  registry: ScenarioRegistry,
  profile: TrialProfile
): readonly ScenarioDefinition[] {
  assertRegistryVersionMatches(profile, registry);

  return [...registry.scenarios]
    .map((scenario) => ({
      scenario,
      score: scoreScenario(scenario, profile),
      tieBreaker: hashSeed(
        `${profile.seed}:${profile.buildSignature}:${scenario.scenarioId}`
      )
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.tieBreaker - right.tieBreaker ||
        left.scenario.scenarioId.localeCompare(right.scenario.scenarioId)
    )
    .map(({ scenario }) => scenario);
}

export function selectScenarios(input: SelectScenarioInput): ScenarioDefinition[] {
  return rankScenarios(input.registry, input.profile).slice(0, input.limit);
}
