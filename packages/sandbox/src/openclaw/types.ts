export interface OpenClawAgentDescriptor {
  readonly agentId: string;
  readonly agentName: string;
  readonly definitionPath: string;
  readonly workspaceRoot: string;
}

export interface ResolvedOpenClawWorkspace {
  readonly stateRoot: string;
  readonly configPath: string;
  readonly agents: readonly OpenClawAgentDescriptor[];
}

export interface OpenClawCommandInput {
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export type OpenClawCommandRunner = (
  input: OpenClawCommandInput
) => Promise<void>;

export interface AppliedOpenClawServingBundle {
  readonly stateRoot: string;
  readonly configPath: string;
  readonly appliedBundlePath: string;
  readonly runtimeConfig: {
    readonly bundleVersionId: string;
    readonly prompt: string;
    readonly memory: readonly string[];
    readonly knowledge: readonly string[];
  };
}
