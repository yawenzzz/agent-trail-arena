export interface CodexAgentDescriptor {
  readonly provider: "codex";
  readonly agentId: string;
  readonly agentName: string;
  readonly workspaceRoot: string;
  readonly definitionPath?: string;
}

export interface PersistedCodexAgentRecord {
  readonly agentId: string;
  readonly agentName: string;
  readonly workspaceRoot: string;
  readonly createdAt: string;
  readonly instructions: string;
  readonly model?: string;
  readonly profile?: string;
  readonly sandbox?: "read-only" | "workspace-write" | "danger-full-access";
}
