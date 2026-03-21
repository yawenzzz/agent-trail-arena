import type { FastifyInstance } from "fastify";
import {
  createOpenClawAgent,
  executeOpenClawCommand,
  resolveOpenClawWorkspace,
  type CreateOpenClawAgentInput,
  type ResolvedOpenClawWorkspace
} from "../../../../packages/sandbox/src/index.js";

interface ResolveWorkspaceBody {
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly workspaceRoot?: string;
}

interface ProvisionAgentBody extends ResolveWorkspaceBody {
  readonly agentName: string;
}

interface OpenClawRouteOptions {
  readonly resolveWorkspace?: (
    input: ResolveWorkspaceBody
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly provisionAgent?: (
    input: CreateOpenClawAgentInput
  ) => Promise<Awaited<ReturnType<typeof createOpenClawAgent>>>;
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
    return {
      message
    };
  }

  if (message.startsWith("OpenClaw command failed")) {
    reply.code(502);
    return {
      message
    };
  }

  throw error;
}

export function registerOpenClawRoutes(
  app: FastifyInstance,
  options: OpenClawRouteOptions = {}
) {
  const resolveWorkspace = options.resolveWorkspace ?? resolveOpenClawWorkspace;
  const provisionAgent = options.provisionAgent ?? createOpenClawAgent;

  function toResolveInput(body: ResolveWorkspaceBody) {
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

  app.post("/openclaw/resolve", async (request, reply) => {
    const body = request.body as ResolveWorkspaceBody;

    try {
      return await resolveWorkspace(toResolveInput(body));
    } catch (error) {
      return replyWithRouteError(reply, error);
    }
  });

  app.post("/openclaw/provision", async (request, reply) => {
    const body = request.body as ProvisionAgentBody;

    try {
      const resolveInput = toResolveInput(body);
      const workspace = await resolveWorkspace(resolveInput);
      const agent = await provisionAgent({
        ...resolveInput,
        agentName: body.agentName,
        existingAgents: workspace.agents,
        runCommand: executeOpenClawCommand,
        resolveWorkspace
      });

      reply.code(201);
      return { agent };
    } catch (error) {
      return replyWithRouteError(reply, error);
    }
  });
}
