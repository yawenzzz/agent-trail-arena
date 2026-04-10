import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ServingRuntimeConfig } from "../../../orchestrator/src/index.js";
import {
  resolveOpenClawConfigPath,
  resolveOpenClawStateRoot
} from "./path-utils.js";
import type { AppliedOpenClawServingBundle } from "./types.js";

export interface ApplyOpenClawServingBundleInput {
  readonly runtimeConfig: ServingRuntimeConfig;
  readonly stateRoot?: string;
  readonly configPath?: string;
}

export function resolveOpenClawServingBundlePath(stateRoot: string): string {
  return join(stateRoot, "trial-arena-serving-bundle.json");
}

export async function applyOpenClawServingBundle(
  input: ApplyOpenClawServingBundleInput
): Promise<AppliedOpenClawServingBundle> {
  const stateRoot = resolveOpenClawStateRoot(input.stateRoot);
  const configPath = resolveOpenClawConfigPath(stateRoot, input.configPath);
  const appliedBundlePath = resolveOpenClawServingBundlePath(stateRoot);

  await mkdir(stateRoot, { recursive: true });
  await writeFile(
    appliedBundlePath,
    JSON.stringify(
      {
        appliedAt: new Date().toISOString(),
        configPath,
        runtimeConfig: input.runtimeConfig
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    stateRoot,
    configPath,
    appliedBundlePath,
    runtimeConfig: input.runtimeConfig
  };
}

export async function readAppliedOpenClawServingBundle(input: {
  readonly stateRoot?: string;
  readonly configPath?: string;
}): Promise<AppliedOpenClawServingBundle> {
  const stateRoot = resolveOpenClawStateRoot(input.stateRoot);
  const configPath = resolveOpenClawConfigPath(stateRoot, input.configPath);
  const appliedBundlePath = resolveOpenClawServingBundlePath(stateRoot);
  const content = await readFile(appliedBundlePath, "utf8");
  const parsed = JSON.parse(content) as {
    readonly runtimeConfig: ServingRuntimeConfig;
  };

  return {
    stateRoot,
    configPath,
    appliedBundlePath,
    runtimeConfig: parsed.runtimeConfig
  };
}
