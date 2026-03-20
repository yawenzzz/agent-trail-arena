import type { FastifyInstance } from "fastify";
import {
  createOpenClawAgent,
  executeOpenClawCommand,
  resolveOpenClawWorkspace,
  type CreateOpenClawAgentInput,
  type ResolvedOpenClawWorkspace
} from "../../../../packages/sandbox/src/index.js";

interface ResolveWorkspaceBody {
  readonly workspaceRoot: string;
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
    message === "OpenClaw workspace root is required." ||
    message.startsWith("OpenClaw workspace root does not exist or is not a directory:") ||
    message.startsWith("Missing .openclaw directory under workspace root:") ||
    message.startsWith("OpenClaw agents path must be a directory when present:") ||
    message.startsWith("Malformed OpenClaw agent definition at") ||
    message.startsWith("Duplicate OpenClaw agent name") ||
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

  app.post("/openclaw/resolve", async (request, reply) => {
    const body = request.body as ResolveWorkspaceBody;

    try {
      return await resolveWorkspace({
        workspaceRoot: body.workspaceRoot
      });
    } catch (error) {
      return replyWithRouteError(reply, error);
    }
  });

  app.post("/openclaw/provision", async (request, reply) => {
    const body = request.body as ProvisionAgentBody;

    try {
      const workspace = await resolveWorkspace({
        workspaceRoot: body.workspaceRoot
      });
      const agent = await provisionAgent({
        workspaceRoot: body.workspaceRoot,
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
