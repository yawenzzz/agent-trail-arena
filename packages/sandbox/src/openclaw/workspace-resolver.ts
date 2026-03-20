import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  OpenClawAgentDescriptor,
  ResolvedOpenClawWorkspace
} from "./types.js";
import {
  expandHomePath,
  resolveOpenClawConfigPath,
  resolveOpenClawStateRoot
} from "./path-utils.js";

export interface ResolveOpenClawWorkspaceInput {
  readonly stateRoot?: string;
  readonly configPath?: string;
}

interface OpenClawAgentConfigEntry {
  readonly id: string;
  readonly name?: string;
  readonly workspace?: string;
}

interface OpenClawConfig {
  readonly agents?: {
    readonly defaults?: {
      readonly workspace?: string;
    };
    readonly list?: readonly OpenClawAgentConfigEntry[];
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripJsonComments(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^\\:])\/\/.*$/gm, "$1");
}

function quoteObjectKeys(input: string): string {
  return input.replace(/([{,\s])([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
}

function normalizeSingleQuotedStrings(input: string): string {
  return input.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, value: string) =>
    JSON.stringify(value.replace(/\\'/g, "'"))
  );
}

function removeTrailingCommas(input: string): string {
  return input.replace(/,\s*([}\]])/g, "$1");
}

function parseOpenClawConfig(rawConfig: string, configPath: string): OpenClawConfig {
  try {
    return JSON.parse(
      removeTrailingCommas(
        normalizeSingleQuotedStrings(quoteObjectKeys(stripJsonComments(rawConfig)))
      )
    ) as OpenClawConfig;
  } catch (error) {
    throw new Error(
      `Malformed OpenClaw config at ${configPath}: ${
        error instanceof Error ? error.message : "invalid JSON5"
      }`
    );
  }
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

async function readConfig(configPath: string): Promise<OpenClawConfig | null> {
  let rawConfig: string;

  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }

    throw new Error(
      `Failed to read OpenClaw config at ${configPath}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }

  return parseOpenClawConfig(rawConfig, configPath);
}

function resolveConfiguredPath(pathname: string, fallbackBase: string): string {
  return join("/", expandHomePath(pathname)).startsWith("//")
    ? expandHomePath(pathname)
    : expandHomePath(pathname).startsWith("/")
      ? expandHomePath(pathname)
      : join(fallbackBase, expandHomePath(pathname));
}

function defaultWorkspaceForAgent(
  stateRoot: string,
  agentId: string,
  configuredDefaultWorkspace?: string
): string {
  if (configuredDefaultWorkspace) {
    return configuredDefaultWorkspace;
  }

  return agentId === "main"
    ? join(stateRoot, "workspace")
    : join(stateRoot, `workspace-${agentId}`);
}

function readConfiguredAgents(
  stateRoot: string,
  configPath: string,
  config: OpenClawConfig | null
): OpenClawAgentDescriptor[] {
  const agentsNode = isObject(config?.agents) ? config.agents : undefined;
  const defaultsNode = isObject(agentsNode?.defaults) ? agentsNode?.defaults : undefined;
  const configuredDefaultWorkspace =
    typeof defaultsNode?.workspace === "string"
      ? resolveConfiguredPath(defaultsNode.workspace, stateRoot)
      : undefined;
  const configuredAgents = Array.isArray(agentsNode?.list) ? agentsNode.list : undefined;

  if (!configuredAgents || configuredAgents.length === 0) {
    return [
      {
        agentId: "main",
        agentName: "main",
        definitionPath: configPath,
        workspaceRoot: defaultWorkspaceForAgent(
          stateRoot,
          "main",
          configuredDefaultWorkspace
        )
      }
    ];
  }

  const seen = new Set<string>();

  return configuredAgents.map((agent, index) => {
    if (!isObject(agent) || typeof agent.id !== "string" || agent.id.trim().length === 0) {
      throw new Error(
        `Malformed OpenClaw config at ${configPath}: agents.list[${index}].id must be a non-empty string`
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
          : agent.id,
      definitionPath: configPath,
      workspaceRoot:
        typeof agent.workspace === "string" && agent.workspace.trim().length > 0
          ? resolveConfiguredPath(agent.workspace, stateRoot)
          : defaultWorkspaceForAgent(stateRoot, agent.id, configuredDefaultWorkspace)
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

  const config = await readConfig(configPath);
  const agents = readConfiguredAgents(stateRoot, configPath, config);

  return {
    stateRoot,
    configPath,
    agents
  };
}
