import type { AgentDescriptor, AgentProvider } from "./trial-types";

export interface ProviderFormState {
  readonly provider: AgentProvider;
  readonly stateRoot: string;
  readonly workspaceRoot: string;
  readonly agents: readonly AgentDescriptor[];
  readonly selectedAgentId: string;
  readonly workspaceError: string | null;
}

export function resetProviderFormStateForSwitch(input: {
  readonly nextProvider: AgentProvider;
  readonly state: ProviderFormState;
}): ProviderFormState {
  return {
    provider: input.nextProvider,
    stateRoot: input.nextProvider === "openclaw" ? input.state.stateRoot : "",
    workspaceRoot: input.nextProvider === "codex" ? input.state.workspaceRoot : "",
    agents: [],
    selectedAgentId: "",
    workspaceError: null
  };
}
