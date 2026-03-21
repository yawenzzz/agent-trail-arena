import { stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  OpenClawAgentDescriptor,
  ResolvedOpenClawWorkspace
} from "./types.js";
import { executeOpenClawJsonCommand } from "./command-runner.js";
import {
  expandHomePath,
  resolveOpenClawConfigPath,
  resolveOpenClawStateRoot
} from "./path-utils.js";

export interface ResolveOpenClawWorkspaceInput {
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly listAgents?: (
    input: ResolveOpenClawDiscoveryInput
  ) => Promise<readonly OpenClawCliAgentEntry[]>;
}

interface OpenClawCliAgentEntry {
  readonly id: string;
  readonly name?: string;
  readonly identityName?: string;
  readonly workspace?: string;
}

interface ResolveOpenClawDiscoveryInput {
  readonly stateRoot: string;
  readonly configPath: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function assertDirectory(pathname: string, message: string): Promise<void> {
  let details;

  try {
    details = await stat(pathname);
  } catch {
    throw new Error(message);
  }

  if (!details.isDirectory()) {
    throw new Error(message);
  }
}

function resolveConfiguredPath(pathname: string, fallbackBase: string): string {
  return join("/", expandHomePath(pathname)).startsWith("//")
    ? expandHomePath(pathname)
    : expandHomePath(pathname).startsWith("/")
      ? expandHomePath(pathname)
      : join(fallbackBase, expandHomePath(pathname));
}

async function discoverAgentsViaCli(
  input: ResolveOpenClawDiscoveryInput
): Promise<readonly OpenClawCliAgentEntry[]> {
  const discovered = await executeOpenClawJsonCommand<unknown>({
    args: ["agents", "list", "--json"],
    env: {
      OPENCLAW_STATE_DIR: input.stateRoot,
      OPENCLAW_CONFIG_PATH: input.configPath
    }
  });

  if (!Array.isArray(discovered)) {
    throw new Error(
      `Malformed OpenClaw agent discovery for ${input.configPath}: expected a JSON array`
    );
  }

  return discovered as readonly OpenClawCliAgentEntry[];
}

function defaultWorkspaceForAgent(
  stateRoot: string,
  agentId: string
): string {
  return agentId === "main"
    ? join(stateRoot, "workspace")
    : join(stateRoot, `workspace-${agentId}`);
}

function readDiscoveredAgents(
  stateRoot: string,
  configPath: string,
  discoveredAgents: readonly OpenClawCliAgentEntry[]
): OpenClawAgentDescriptor[] {
  if (discoveredAgents.length === 0) {
    return [
      {
        agentId: "main",
        agentName: "main",
        definitionPath: configPath,
        workspaceRoot: defaultWorkspaceForAgent(stateRoot, "main")
      }
    ];
  }

  const seen = new Set<string>();

  return discoveredAgents.map((agent, index) => {
    if (!isObject(agent) || typeof agent.id !== "string" || agent.id.trim().length === 0) {
      throw new Error(
        `Malformed OpenClaw agent discovery for ${configPath}: entry ${index} is missing a non-empty string id`
      );
    }

    if (seen.has(agent.id)) {
      throw new Error(
        `Duplicate OpenClaw agent id "${agent.id}" found in config ${configPath}`
      );
    }

    seen.add(agent.id);

    return {
      agentId: agent.id,
      agentName:
        typeof agent.name === "string" && agent.name.trim().length > 0
          ? agent.name
          : typeof agent.identityName === "string" && agent.identityName.trim().length > 0
            ? agent.identityName
          : agent.id,
      definitionPath: configPath,
      workspaceRoot:
        typeof agent.workspace === "string" && agent.workspace.trim().length > 0
          ? resolveConfiguredPath(agent.workspace, stateRoot)
          : defaultWorkspaceForAgent(stateRoot, agent.id)
    };
  });
}

export async function resolveOpenClawWorkspace(
  input: ResolveOpenClawWorkspaceInput = {}
): Promise<ResolvedOpenClawWorkspace> {
  const stateRoot = resolveOpenClawStateRoot(input.stateRoot);
  const configPath = resolveOpenClawConfigPath(stateRoot, input.configPath);

  await assertDirectory(
    stateRoot,
    `OpenClaw state root does not exist or is not a directory: ${stateRoot}`
  );

  const discoveredAgents = await (input.listAgents ?? discoverAgentsViaCli)({
    stateRoot,
    configPath
  });
  const agents = readDiscoveredAgents(stateRoot, configPath, discoveredAgents);

  return {
    stateRoot,
    configPath,
    agents
  };
}
