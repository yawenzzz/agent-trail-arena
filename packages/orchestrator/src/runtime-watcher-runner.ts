import {
  createFileBackedCapabilityImprovementStoreSync,
  type CreateFileBackedCapabilityImprovementStoreInput
} from "./file-backed-capability-store.js";
import {
  runRuntimeWatcherOnLatestSnapshots,
  watchRuntimeGuardrails,
  type RuntimeWatcherResult,
  type RuntimeWatcherLoopResult
} from "./runtime-watcher.js";

export interface RunCapabilityWatcherCycleInput
  extends CreateFileBackedCapabilityImprovementStoreInput {
  readonly evaluatedAt?: string;
  readonly triggerRollback?: boolean;
}

export interface RunCapabilityWatcherDaemonInput
  extends CreateFileBackedCapabilityImprovementStoreInput {
  readonly tickCount: number;
  readonly evaluatedAtSeed?: string;
  readonly intervalMs?: number;
  readonly triggerRollbackOnFinalTick?: boolean;
  readonly baselineSnapshotId?: string;
  readonly observedSnapshotId?: string;
  readonly sleep?: (ms: number) => Promise<void>;
}

export function runCapabilityWatcherCycle(
  input: RunCapabilityWatcherCycleInput
): RuntimeWatcherResult {
  const store = createFileBackedCapabilityImprovementStoreSync({
    stateFilePath: input.stateFilePath
  });

  return runRuntimeWatcherOnLatestSnapshots({
    store,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    triggerRollback: input.triggerRollback ?? false
  });
}

export async function runCapabilityWatcherDaemon(
  input: RunCapabilityWatcherDaemonInput
): Promise<RuntimeWatcherLoopResult> {
  const store = createFileBackedCapabilityImprovementStoreSync({
    stateFilePath: input.stateFilePath
  });

  return watchRuntimeGuardrails({
    store,
    tickCount: input.tickCount,
    evaluatedAtSeed: input.evaluatedAtSeed ?? new Date().toISOString(),
    intervalMs: input.intervalMs,
    triggerRollbackOnFinalTick: input.triggerRollbackOnFinalTick,
    baselineSnapshotId: input.baselineSnapshotId,
    observedSnapshotId: input.observedSnapshotId,
    sleep: input.sleep
  });
}
