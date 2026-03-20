import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  OpenClawAgentDescriptor,
  ResolvedOpenClawWorkspace
} from "./types.js";

export interface ResolveOpenClawWorkspaceInput {
  readonly workspaceRoot: string;
}

interface OpenClawAgentDefinitionSource {
  readonly name: string;
  readonly definitionPath: string;
}

function createOpenClawAgentId(definitionPath: string): string {
  const hash = createHash("sha256")
    .update(resolve(definitionPath))
    .digest("hex")
    .slice(0, 16);

  return `openclaw_${hash}`;
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

async function collectDefinitionPaths(directory: string): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await collectDefinitionPaths(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      paths.push(entryPath);
    }
  }

  return paths.sort((left, right) => left.localeCompare(right));
}

async function readAgentDefinitions(
  agentsRoot: string
): Promise<OpenClawAgentDefinitionSource[]> {
  const definitionPaths = await collectDefinitionPaths(agentsRoot);
  const definitions: OpenClawAgentDefinitionSource[] = [];

  for (const definitionPath of definitionPaths) {
    let rawDefinition: string;

    try {
      rawDefinition = await readFile(definitionPath, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to read OpenClaw agent definition at ${definitionPath}: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }

    let parsedDefinition: unknown;

    try {
      parsedDefinition = JSON.parse(rawDefinition);
    } catch (error) {
      throw new Error(
        `Malformed OpenClaw agent definition at ${definitionPath}: ${
          error instanceof Error ? error.message : "invalid JSON"
        }`
      );
    }

    if (
      typeof parsedDefinition !== "object" ||
      parsedDefinition === null ||
      !("name" in parsedDefinition) ||
      typeof parsedDefinition.name !== "string" ||
      parsedDefinition.name.trim().length === 0
    ) {
      throw new Error(
        `Malformed OpenClaw agent definition at ${definitionPath}: missing string name`
      );
    }

    definitions.push({
      name: parsedDefinition.name,
      definitionPath
    });
  }

  return definitions;
}

function assertUniqueAgentDefinitionNames(
  definitions: readonly OpenClawAgentDefinitionSource[],
  workspaceRoot: string
): void {
  const seen = new Map<string, string>();

  for (const definition of definitions) {
    const existingPath = seen.get(definition.name);

    if (existingPath) {
      throw new Error(
        `Duplicate OpenClaw agent name "${definition.name}" found in workspace ${workspaceRoot}: ${existingPath} and ${definition.definitionPath}`
      );
    }

    seen.set(definition.name, definition.definitionPath);
  }
}

export async function resolveOpenClawWorkspace(
  input: ResolveOpenClawWorkspaceInput
): Promise<ResolvedOpenClawWorkspace> {
  if (!input.workspaceRoot || input.workspaceRoot.trim().length === 0) {
    throw new Error("OpenClaw workspace root is required.");
  }

  const workspaceRoot = resolve(input.workspaceRoot);

  await assertDirectory(
    workspaceRoot,
    `OpenClaw workspace root does not exist or is not a directory: ${workspaceRoot}`
  );

  const openclawRoot = join(workspaceRoot, ".openclaw");

  await assertDirectory(
    openclawRoot,
    `Missing .openclaw directory under workspace root: ${workspaceRoot}`
  );

  const agentsRoot = join(openclawRoot, "agents");
  const agentsRootDetails = await stat(agentsRoot).catch(() => null);

  if (agentsRootDetails && !agentsRootDetails.isDirectory()) {
    throw new Error(
      `OpenClaw agents path must be a directory when present: ${agentsRoot}`
    );
  }

  const definitionSources = await readAgentDefinitions(agentsRoot);
  assertUniqueAgentDefinitionNames(definitionSources, workspaceRoot);

  const agents: OpenClawAgentDescriptor[] = definitionSources.map((definition) => ({
    agentId: createOpenClawAgentId(definition.definitionPath),
    agentName: definition.name,
    definitionPath: definition.definitionPath,
    workspaceRoot
  }));

  return {
    workspaceRoot,
    openclawRoot,
    agents
  };
}
