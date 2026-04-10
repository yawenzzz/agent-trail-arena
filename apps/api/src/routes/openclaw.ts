import type { FastifyInstance } from "fastify";
import {
  applyOpenClawServingBundle,
  createOpenClawAgent,
  executeOpenClawCommand,
  readAppliedOpenClawServingBundle,
  resolveOpenClawServingRuntimeConfig,
  resolveOpenClawWorkspace,
  type CreateOpenClawAgentInput,
  type ResolvedOpenClawWorkspace
} from "../../../../packages/sandbox/src/index.js";
import {
  resolveServingBundle,
  resolveServingRuntimeConfig,
  type CapabilityImprovementStore
} from "../../../../packages/orchestrator/src/index.js";

interface ResolveWorkspaceBody {
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly workspaceRoot?: string;
}

interface ProvisionAgentBody extends ResolveWorkspaceBody {
  readonly agentName: string;
}

interface ApplyServingBundleBody extends ResolveWorkspaceBody {
  readonly bundleVersionId?: string;
}

interface OpenClawRouteOptions {
  readonly resolveWorkspace?: (
    input: ResolveWorkspaceBody
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly provisionAgent?: (
    input: CreateOpenClawAgentInput
  ) => Promise<Awaited<ReturnType<typeof createOpenClawAgent>>>;
  readonly capabilityStore?: CapabilityImprovementStore;
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

  app.post("/openclaw/serving-bundle/apply", async (request, reply) => {
    if (!options.capabilityStore) {
      reply.code(501);
      return {
        message: "Capability store is not configured for serving bundle application."
      };
    }

    const body = request.body as ApplyServingBundleBody;
    const resolveInput = toResolveInput(body);

    try {
      const bundle = resolveServingBundle(options.capabilityStore, body.bundleVersionId);
      const applied = await applyOpenClawServingBundle({
        stateRoot: resolveInput.stateRoot,
        configPath: resolveInput.configPath,
        runtimeConfig: resolveServingRuntimeConfig(bundle)
      });

      return { applied };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Unknown serving bundle:")
      ) {
        reply.code(404);
        return {
          message: error.message
        };
      }

      return replyWithRouteError(reply, error);
    }
  });

  app.get("/openclaw/serving-bundle/applied", async (request, reply) => {
    const query = request.query as ResolveWorkspaceBody;
    const resolveInput = toResolveInput(query);

    try {
      return {
        applied: await readAppliedOpenClawServingBundle(resolveInput)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reply.code(404);
        return {
          message: "No applied serving bundle was found for the requested OpenClaw state root."
        };
      }

      return replyWithRouteError(reply, error);
    }
  });

  app.get("/openclaw/serving-bundle/runtime-config", async (request, reply) => {
    const query = request.query as ResolveWorkspaceBody;
    const resolveInput = toResolveInput(query);

    try {
      return {
        runtimeConfig: await resolveOpenClawServingRuntimeConfig(resolveInput)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reply.code(404);
        return {
          message: "No applied serving bundle was found for the requested OpenClaw state root."
        };
      }

      return replyWithRouteError(reply, error);
    }
  });
}
