import { homedir } from "node:os";
import { join, resolve } from "node:path";

function isPopulatedPath(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function expandHomePath(input: string): string {
  if (input === "~") {
    return homedir();
  }

  if (input.startsWith("~/")) {
    return join(homedir(), input.slice(2));
  }

  return input;
}

export function resolveOpenClawStateRoot(input?: string): string {
  return resolve(
    expandHomePath(input && input.trim().length > 0 ? input : process.env.OPENCLAW_STATE_DIR ?? "~/.openclaw")
  );
}

export function resolveOpenClawConfigPath(
  stateRoot: string,
  configPath?: string
): string {
  if (isPopulatedPath(configPath)) {
    return resolve(expandHomePath(configPath));
  }

  const envConfigPath = process.env.OPENCLAW_CONFIG_PATH;
  if (isPopulatedPath(envConfigPath)) {
    return resolve(expandHomePath(envConfigPath));
  }

  return join(stateRoot, "openclaw.json");
}
