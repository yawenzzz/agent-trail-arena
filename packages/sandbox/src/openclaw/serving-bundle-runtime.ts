import type { AppliedOpenClawServingBundle } from "./types.js";
import { readAppliedOpenClawServingBundle } from "./serving-bundle-applier.js";

export interface ResolveOpenClawServingRuntimeConfigInput {
  readonly stateRoot?: string;
  readonly configPath?: string;
}

export interface ResolvedOpenClawServingRuntimeConfig {
  readonly bundleVersionId: string;
  readonly prompt: string;
  readonly memory: readonly string[];
  readonly knowledge: readonly string[];
  readonly applied: AppliedOpenClawServingBundle;
}

export async function resolveOpenClawServingRuntimeConfig(
  input: ResolveOpenClawServingRuntimeConfigInput = {}
): Promise<ResolvedOpenClawServingRuntimeConfig> {
  const applied = await readAppliedOpenClawServingBundle(input);

  return {
    bundleVersionId: applied.runtimeConfig.bundleVersionId,
    prompt: applied.runtimeConfig.prompt,
    memory: [...applied.runtimeConfig.memory],
    knowledge: [...applied.runtimeConfig.knowledge],
    applied
  };
}
