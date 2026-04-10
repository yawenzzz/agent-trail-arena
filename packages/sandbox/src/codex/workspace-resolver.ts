import { readCodexAgentRecords } from "./workspace-store.js";
import type { CodexAgentDescriptor } from "./types.js";

export interface ResolveCodexWorkspaceInput {
  readonly workspaceRoot: string;
}

export interface ResolvedCodexWorkspace {
  readonly provider: "codex";
  readonly workspaceRoot: string;
  readonly agents: readonly CodexAgentDescriptor[];
}

export function resolveCodexWorkspace(
  input: ResolveCodexWorkspaceInput
): ResolvedCodexWorkspace {
  return {
    provider: "codex",
    workspaceRoot: input.workspaceRoot,
    agents: readCodexAgentRecords({ workspaceRoot: input.workspaceRoot }).map((record) => ({
      provider: "codex",
      agentId: record.agentId,
      agentName: record.agentName,
      workspaceRoot: record.workspaceRoot
    }))
  };
}
