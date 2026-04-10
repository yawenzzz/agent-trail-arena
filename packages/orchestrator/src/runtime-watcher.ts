import type { CapabilityImprovementStore } from "./capability-store.js";
import {
  resolveServingBundle,
  resolveServingRuntimeConfig,
  type ServingRuntimeConfig
} from "./serving-bundle-resolver.js";

export interface RuntimeWatcherInput {
  readonly store: CapabilityImprovementStore;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly evaluatedAt: string;
  readonly triggerRollback?: boolean;
}

export interface RuntimeWatcherResult {
  readonly runtimeConfig: ServingRuntimeConfig;
  readonly evaluation: ReturnType<CapabilityImprovementStore["evaluateRollbackGuardrails"]>;
}

export interface RuntimeWatcherLatestInput {
  readonly store: CapabilityImprovementStore;
  readonly evaluatedAt: string;
  readonly triggerRollback?: boolean;
}

export interface RuntimeWatcherLoopInput {
  readonly store: CapabilityImprovementStore;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
  readonly tickCount: number;
  readonly evaluatedAtSeed: string;
  readonly triggerRollbackOnFinalTick?: boolean;
}

export interface RuntimeWatcherLoopResult {
  readonly ticks: readonly RuntimeWatcherResult[];
}

export interface RuntimeWatcherSnapshotPair {
  readonly activeBundleVersionId: string;
  readonly baselineSnapshotId: string;
  readonly observedSnapshotId: string;
}

function calculateTickTime(seed: string, stepMs: number, index: number): string {
  return new Date(new Date(seed).getTime() + index * stepMs).toISOString();
}

export function runRuntimeWatcher(input: RuntimeWatcherInput): RuntimeWatcherResult {
  const activeBundle = resolveServingBundle(input.store);
  const runtimeConfig = resolveServingRuntimeConfig(activeBundle);
  const evaluation = input.store.evaluateRollbackGuardrails({
    activeBundleVersionId: activeBundle.bundleVersionId,
    baselineSnapshotId: input.baselineSnapshotId,
    observedSnapshotId: input.observedSnapshotId,
    evaluatedAt: input.evaluatedAt,
    triggerRollback: input.triggerRollback ?? false
  });

  return {
    runtimeConfig,
    evaluation
  };
}

export function selectLatestRuntimeWatcherSnapshotPair(
  store: CapabilityImprovementStore
): RuntimeWatcherSnapshotPair {
  const activeBundle = resolveServingBundle(store);
  const snapshots = [...store.listMetricSnapshots()].sort((left, right) =>
    left.capturedAt.localeCompare(right.capturedAt)
  );
  const observed = [...snapshots]
    .reverse()
    .find((snapshot) => snapshot.bundleVersionId === activeBundle.bundleVersionId);
  if (!observed) {
    throw new Error(
      `No observed metric snapshot found for active bundle ${activeBundle.bundleVersionId}.`
    );
  }

  const baseline = [...snapshots]
    .reverse()
    .find((snapshot) => snapshot.bundleVersionId !== activeBundle.bundleVersionId);
  if (!baseline) {
    throw new Error("No baseline metric snapshot found for runtime watcher.");
  }

  return {
    activeBundleVersionId: activeBundle.bundleVersionId,
    baselineSnapshotId: baseline.snapshotId,
    observedSnapshotId: observed.snapshotId
  };
}

export function runRuntimeWatcherOnLatestSnapshots(
  input: RuntimeWatcherLatestInput
): RuntimeWatcherResult {
  const pair = selectLatestRuntimeWatcherSnapshotPair(input.store);
  return runRuntimeWatcher({
    store: input.store,
    baselineSnapshotId: pair.baselineSnapshotId,
    observedSnapshotId: pair.observedSnapshotId,
    evaluatedAt: input.evaluatedAt,
    triggerRollback: input.triggerRollback ?? false
  });
}

export function runRuntimeWatcherLoop(
  input: RuntimeWatcherLoopInput
): RuntimeWatcherLoopResult {
  const ticks = [];

  for (let index = 0; index < input.tickCount; index += 1) {
    const tickTime = calculateTickTime(input.evaluatedAtSeed, 60_000, index);
    ticks.push(
      runRuntimeWatcher({
        store: input.store,
        baselineSnapshotId: input.baselineSnapshotId,
        observedSnapshotId: input.observedSnapshotId,
        evaluatedAt: tickTime,
        triggerRollback:
          input.triggerRollbackOnFinalTick === true && index === input.tickCount - 1
      })
    );
  }

  return {
    ticks
  };
}

export interface WatchRuntimeGuardrailsInput {
  readonly store: CapabilityImprovementStore;
  readonly tickCount: number;
  readonly intervalMs?: number;
  readonly evaluatedAtSeed: string;
  readonly baselineSnapshotId?: string;
  readonly observedSnapshotId?: string;
  readonly triggerRollbackOnFinalTick?: boolean;
  readonly sleep?: (ms: number) => Promise<void>;
}

export async function watchRuntimeGuardrails(
  input: WatchRuntimeGuardrailsInput
): Promise<RuntimeWatcherLoopResult> {
  const ticks: RuntimeWatcherResult[] = [];
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let index = 0; index < input.tickCount; index += 1) {
    const tickTime = calculateTickTime(
      input.evaluatedAtSeed,
      input.intervalMs ?? 60_000,
      index
    );
    const triggerRollback =
      input.triggerRollbackOnFinalTick === true && index === input.tickCount - 1;

    ticks.push(
      input.baselineSnapshotId && input.observedSnapshotId
        ? runRuntimeWatcher({
            store: input.store,
            baselineSnapshotId: input.baselineSnapshotId,
            observedSnapshotId: input.observedSnapshotId,
            evaluatedAt: tickTime,
            triggerRollback
          })
        : runRuntimeWatcherOnLatestSnapshots({
            store: input.store,
            evaluatedAt: tickTime,
            triggerRollback
          })
    );

    if (index < input.tickCount - 1) {
      await sleep(input.intervalMs ?? 60_000);
    }
  }

  return { ticks };
}
