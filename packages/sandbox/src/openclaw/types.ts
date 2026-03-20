export interface OpenClawAgentDescriptor {
  readonly agentId: string;
  readonly agentName: string;
  readonly definitionPath: string;
  readonly workspaceRoot: string;
}

export interface ResolvedOpenClawWorkspace {
  readonly workspaceRoot: string;
  readonly openclawRoot: string;
  readonly agents: readonly OpenClawAgentDescriptor[];
}

export interface OpenClawCommandInput {
  readonly args: readonly string[];
  readonly cwd?: string;
}

export type OpenClawCommandRunner = (
  input: OpenClawCommandInput
) => Promise<void>;

