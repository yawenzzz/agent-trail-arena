import {
  runCapabilityWatcherCycle,
  runCapabilityWatcherDaemon
} from "../../../packages/orchestrator/src/index.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const stateFilePath = requireEnv("OPENCLAW_CAPABILITY_STORE_PATH");
  const daemon = process.env.OPENCLAW_CAPABILITY_WATCHER_DAEMON === "1";

  if (daemon) {
    const tickCount = Number(process.env.OPENCLAW_CAPABILITY_WATCHER_TICK_COUNT ?? "1");
    const intervalMs = Number(process.env.OPENCLAW_CAPABILITY_WATCHER_INTERVAL_MS ?? "60000");
    const evaluatedAtSeed =
      process.env.OPENCLAW_CAPABILITY_WATCHER_EVALUATED_AT_SEED ?? new Date().toISOString();

    const result = await runCapabilityWatcherDaemon({
      stateFilePath,
      tickCount,
      intervalMs,
      evaluatedAtSeed,
      triggerRollbackOnFinalTick:
        process.env.OPENCLAW_CAPABILITY_WATCHER_TRIGGER_ROLLBACK === "1"
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const result = runCapabilityWatcherCycle({
    stateFilePath,
    evaluatedAt: new Date().toISOString(),
    triggerRollback: process.env.OPENCLAW_CAPABILITY_WATCHER_TRIGGER_ROLLBACK === "1"
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
