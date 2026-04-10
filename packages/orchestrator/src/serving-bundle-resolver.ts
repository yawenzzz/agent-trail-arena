import type { ServingBundle, ServingBundleVersion } from "@openclaw/domain";
import type { CapabilityImprovementStore } from "./capability-store.js";

export interface ServingRuntimeConfig {
  readonly bundleVersionId: string;
  readonly prompt: string;
  readonly memory: readonly string[];
  readonly knowledge: readonly string[];
}

export function resolveServingBundle(
  store: CapabilityImprovementStore,
  bundleVersionId?: string
): ServingBundleVersion {
  if (!bundleVersionId) {
    return store.getActiveServingBundle();
  }

  const bundle = store.getServingBundleVersion(bundleVersionId);
  if (!bundle) {
    throw new Error(`Unknown serving bundle: ${bundleVersionId}`);
  }

  return bundle;
}

export function resolveServingRuntimeConfig(
  bundle: Pick<ServingBundleVersion, "bundleVersionId" | "bundle">
): ServingRuntimeConfig {
  const runtimeBundle: ServingBundle = bundle.bundle;

  return {
    bundleVersionId: bundle.bundleVersionId,
    prompt: runtimeBundle.prompt,
    memory: [...runtimeBundle.memory],
    knowledge: [...runtimeBundle.knowledge]
  };
}
