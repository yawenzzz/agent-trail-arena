import {
  attributeNames,
  type AttributeLevel,
  type AttributeName,
  type DeclaredBuild,
  type BuildAttributeEntry
} from "./attributes.js";

export interface TrialProfileInput {
  readonly agentVersion: string;
  readonly build: DeclaredBuild;
  readonly scenarioRegistryVersion: string;
  readonly judgeConfigVersion: string;
  readonly seed: string;
}

export interface TrialProfile extends TrialProfileInput {
  readonly profileId: string;
  readonly buildSignature: string;
  readonly buildEntries: readonly BuildAttributeEntry[];
}

export function serializeDeclaredBuild(build: DeclaredBuild): string {
  return attributeNames
    .flatMap((attribute) => {
      const level = build[attribute];
      return level === undefined ? [] : [`${attribute}=${level}`];
    })
    .join(",");
}

function toBuildEntries(build: DeclaredBuild): BuildAttributeEntry[] {
  return attributeNames.flatMap((attribute) => {
    const level = build[attribute];
    return level === undefined ? [] : [{ attribute, level }];
  });
}

export function createTrialProfile(input: TrialProfileInput): TrialProfile {
  const buildEntries = toBuildEntries(input.build);
  const buildSignature = serializeDeclaredBuild(input.build);

  return {
    ...input,
    profileId: [
      input.agentVersion,
      input.scenarioRegistryVersion,
      input.judgeConfigVersion,
      input.seed
    ].join(":"),
    buildSignature,
    buildEntries
  };
}

export type { AttributeLevel, AttributeName, DeclaredBuild } from "./attributes.js";
