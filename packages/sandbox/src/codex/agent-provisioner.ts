import { normalizeCodexAgentId } from "./agent-id.js";
import { appendCodexAgentRecord, readCodexAgentRecords } from "./workspace-store.js";
import type { CodexAgentDescriptor, PersistedCodexAgentRecord } from "./types.js";

export interface CreateCodexAgentInput {
  readonly workspaceRoot: string;
  readonly agentName: string;
  readonly now?: () => string;
}

function createDefaultInstructions(agentName: string): string {
  return `You are the Codex agent preset \"${agentName}\" for Trial Arena scenario runs.`;
}

export function createCodexAgent(input: CreateCodexAgentInput): CodexAgentDescriptor {
  const agentId = normalizeCodexAgentId(input.agentName);
  const existing = readCodexAgentRecords({ workspaceRoot: input.workspaceRoot });

  if (existing.some((record) => record.agentId === agentId)) {
    throw new Error(`Codex agent "${agentId}" already exists`);
  }

  const record: PersistedCodexAgentRecord = {
    agentId,
    agentName: input.agentName,
    workspaceRoot: input.workspaceRoot,
    createdAt: input.now?.() ?? new Date().toISOString(),
    instructions: createDefaultInstructions(input.agentName)
  };

  appendCodexAgentRecord({
    workspaceRoot: input.workspaceRoot,
    record
  });

  return {
    provider: "codex",
    agentId,
    agentName: input.agentName,
    workspaceRoot: input.workspaceRoot
  };
}
