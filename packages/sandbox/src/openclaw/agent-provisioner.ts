import type {
  OpenClawAgentDescriptor,
  OpenClawCommandRunner,
  ResolvedOpenClawWorkspace
} from "./types.js";
import { executeOpenClawCommand } from "./command-runner.js";
import {
  resolveOpenClawWorkspace,
  type ResolveOpenClawWorkspaceInput
} from "./workspace-resolver.js";
import {
  resolveOpenClawConfigPath,
  resolveOpenClawStateRoot
} from "./path-utils.js";

export interface CreateOpenClawAgentInput {
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly agentName: string;
  readonly existingAgents?: readonly OpenClawAgentDescriptor[];
  readonly resolveWorkspace?: (
    input: ResolveOpenClawWorkspaceInput
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly runCommand?: OpenClawCommandRunner;
}

function assertValidAgentName(agentName: string): void {
  if (agentName.trim() !== agentName || agentName.length === 0) {
    throw new Error(
      `Invalid OpenClaw agent name "${agentName}". Use a non-empty identifier with no leading or trailing whitespace.`
    );
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(agentName)) {
    throw new Error(
      `Invalid OpenClaw agent name "${agentName}". Use 1-64 characters from letters, numbers, ".", "_" or "-".`
    );
  }
}

function assertUniqueAgentName(
  agentName: string,
  existingAgents: readonly OpenClawAgentDescriptor[]
): void {
  const duplicate = existingAgents.find((agent) => agent.agentName === agentName);

  if (duplicate) {
    throw new Error(
      `OpenClaw agent "${agentName}" already exists in workspace ${duplicate.workspaceRoot}.`
    );
  }
}

export async function createOpenClawAgent(
  input: CreateOpenClawAgentInput
): Promise<OpenClawAgentDescriptor> {
  assertValidAgentName(input.agentName);
  const stateRoot = resolveOpenClawStateRoot(input.stateRoot);
  const configPath = resolveOpenClawConfigPath(stateRoot, input.configPath);

  const resolveWorkspace = input.resolveWorkspace ?? resolveOpenClawWorkspace;
  const runCommand = input.runCommand ?? executeOpenClawCommand;

  const existingAgents =
    input.existingAgents ?? (await resolveWorkspace({ stateRoot, configPath })).agents;

  assertUniqueAgentName(input.agentName, existingAgents);

  await runCommand({
    args: ["agents", "add", input.agentName],
    env: {
      OPENCLAW_STATE_DIR: stateRoot,
      OPENCLAW_CONFIG_PATH: configPath
    }
  });

  const refreshedWorkspace = await resolveWorkspace({
    stateRoot,
    configPath
  });
  const createdAgent = refreshedWorkspace.agents.find(
    (agent) => agent.agentName === input.agentName
  );

  if (!createdAgent) {
    throw new Error(
      `Agent creation did not produce a definition for ${input.agentName}.`
    );
  }

  return createdAgent;
}
