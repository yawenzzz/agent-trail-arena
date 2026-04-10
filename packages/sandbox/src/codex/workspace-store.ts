import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PersistedCodexAgentRecord } from "./types.js";

export function resolveCodexAgentStorePath(workspaceRoot: string): string {
  return join(workspaceRoot, ".trial-arena", "codex-agents.json");
}

export function readCodexAgentRecords(input: {
  readonly workspaceRoot: string;
}): PersistedCodexAgentRecord[] {
  const storePath = resolveCodexAgentStorePath(input.workspaceRoot);

  try {
    const content = readFileSync(storePath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("expected array");
    }

    return parsed as PersistedCodexAgentRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw new Error(`Malformed Codex agent discovery for ${storePath}`);
  }
}

export function appendCodexAgentRecord(input: {
  readonly workspaceRoot: string;
  readonly record: PersistedCodexAgentRecord;
}): PersistedCodexAgentRecord[] {
  const storePath = resolveCodexAgentStorePath(input.workspaceRoot);
  const records = readCodexAgentRecords({ workspaceRoot: input.workspaceRoot });
  const nextRecords = [...records, input.record];

  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(nextRecords, null, 2), "utf8");

  return nextRecords;
}
