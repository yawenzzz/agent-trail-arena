import type { FastifyInstance } from "fastify";
import {
  createCodexAgent,
  createOpenClawAgent,
  executeOpenClawCommand,
  resolveCodexWorkspace,
  resolveOpenClawWorkspace,
  type CodexAgentDescriptor,
  type ResolvedCodexWorkspace,
  type CreateOpenClawAgentInput,
  type ResolvedOpenClawWorkspace
} from "../../../../packages/sandbox/src/index.js";

interface ResolveAgentsBody {
  readonly provider: "openclaw" | "codex";
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly workspaceRoot?: string;
}

interface ProvisionAgentBody extends ResolveAgentsBody {
  readonly agentName: string;
}

interface AgentRouteOptions {
  readonly resolveOpenClawWorkspace?: (
    input: { stateRoot?: string; configPath?: string }
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly provisionOpenClawAgent?: (
    input: CreateOpenClawAgentInput
  ) => Promise<Awaited<ReturnType<typeof createOpenClawAgent>>>;
  readonly resolveCodexWorkspace?: (input: {
    workspaceRoot: string;
  }) => ResolvedCodexWorkspace | Promise<ResolvedCodexWorkspace>;
  readonly provisionCodexAgent?: (input: {
    workspaceRoot: string;
    agentName: string;
  }) => CodexAgentDescriptor | Promise<CodexAgentDescriptor>;
}

function replyWithRouteError(reply: { code: (statusCode: number) => unknown }, error: unknown) {
  if (!(error instanceof Error)) {
    throw error;
  }

  const message = error.message;

  if (
    message.startsWith("OpenClaw state root does not exist or is not a directory:") ||
    message.startsWith("Malformed OpenClaw config at") ||
    message.startsWith("Malformed OpenClaw agent discovery for") ||
    message.startsWith("Duplicate OpenClaw agent id") ||
    message.startsWith("Invalid OpenClaw agent name") ||
    message.includes("already exists") ||
    message.startsWith("Agent creation did not produce a definition for")
  ) {
    reply.code(400);
    return { message };
  }

  if (message.startsWith("OpenClaw command failed")) {
    reply.code(502);
    return { message };
  }

  throw error;
}

function toOpenClawResolveInput(body: ResolveAgentsBody) {
  return {
    stateRoot:
      typeof body.stateRoot === "string" && body.stateRoot.trim().length > 0
        ? body.stateRoot
        : typeof body.workspaceRoot === "string" && body.workspaceRoot.trim().length > 0
          ? body.workspaceRoot
          : undefined,
    configPath:
      typeof body.configPath === "string" && body.configPath.trim().length > 0
        ? body.configPath
        : undefined
  };
}

export function registerAgentRoutes(app: FastifyInstance, options: AgentRouteOptions = {}) {
  const resolveWorkspace = options.resolveOpenClawWorkspace ?? resolveOpenClawWorkspace;
  const provisionAgent = options.provisionOpenClawAgent ?? createOpenClawAgent;
  const resolveCodex = options.resolveCodexWorkspace ?? resolveCodexWorkspace;
  const provisionCodex = options.provisionCodexAgent ?? createCodexAgent;

  app.post("/agents/resolve", async (request, reply) => {
    const body = request.body as ResolveAgentsBody;

    if (body.provider === "codex") {
      return resolveCodex({
        workspaceRoot: body.workspaceRoot ?? ""
      });
    }

    try {
      const workspace = await resolveWorkspace(toOpenClawResolveInput(body));
      return {
        provider: "openclaw" as const,
        ...workspace,
        agents: workspace.agents.map((agent) => ({
          provider: "openclaw" as const,
          ...agent
        }))
      };
    } catch (error) {
      return replyWithRouteError(reply, error);
    }
  });

  app.post("/agents/provision", async (request, reply) => {
    const body = request.body as ProvisionAgentBody;

    if (body.provider === "codex") {
      const agent = await provisionCodex({
        workspaceRoot: body.workspaceRoot ?? "",
        agentName: body.agentName
      });

      reply.code(201);
      return { agent };
    }

    try {
      const resolveInput = toOpenClawResolveInput(body);
      const workspace = await resolveWorkspace(resolveInput);
      const agent = await provisionAgent({
        ...resolveInput,
        agentName: body.agentName,
        existingAgents: workspace.agents,
        runCommand: executeOpenClawCommand,
        resolveWorkspace
      });

      reply.code(201);
      return {
        agent: {
          provider: "openclaw" as const,
          ...agent
        }
      };
    } catch (error) {
      return replyWithRouteError(reply, error);
    }
  });
}
