import Fastify from "fastify";
import { createInMemoryRunStore } from "../../../packages/orchestrator/src/index.js";
import {
  OpenClawGatewayClient,
  createOpenClawAgent,
  resolveOpenClawWorkspace,
  type CreateOpenClawAgentInput,
  type OpenClawGateway,
  type ResolvedOpenClawWorkspace
} from "../../../packages/sandbox/src/index.js";
import { readOpenClawConfig, type OpenClawConfig } from "./config/openclaw.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerOpenClawRoutes } from "./routes/openclaw.js";
import { registerReplayRoutes } from "./routes/replay.js";
import { registerRunRoutes } from "./routes/runs.js";

interface BuildAppOptions {
  readonly store?: ReturnType<typeof createInMemoryRunStore>;
  readonly openClawConfig?: OpenClawConfig;
  readonly resolveOpenClawWorkspace?: (
    input: { workspaceRoot: string }
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly provisionOpenClawAgent?: (
    input: CreateOpenClawAgentInput
  ) => Promise<Awaited<ReturnType<typeof createOpenClawAgent>>>;
  readonly createOpenClawGateway?: (config: OpenClawConfig) => OpenClawGateway;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const store = options.store ?? createInMemoryRunStore();
  const openClawConfig = options.openClawConfig ?? readOpenClawConfig();
  const createOpenClawGateway =
    options.createOpenClawGateway ??
    ((config: OpenClawConfig) =>
      new OpenClawGatewayClient({
        url: config.gatewayUrl,
        token: config.gatewayToken,
        password: config.gatewayPassword
      }));

  app.options("/*", async (_request, reply) => {
    reply
      .header("access-control-allow-origin", "*")
      .header("access-control-allow-methods", "GET,POST,OPTIONS")
      .header("access-control-allow-headers", "content-type")
      .code(204)
      .send();
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("access-control-allow-origin", "*");
    reply.header("access-control-allow-methods", "GET,POST,OPTIONS");
    reply.header("access-control-allow-headers", "content-type");
    return payload;
  });

  registerHealthRoutes(app);
  registerOpenClawRoutes(app, {
    resolveWorkspace: options.resolveOpenClawWorkspace ?? resolveOpenClawWorkspace,
    provisionAgent: options.provisionOpenClawAgent ?? createOpenClawAgent
  });
  registerRunRoutes(app, { store, openClawConfig, createOpenClawGateway });
  registerReplayRoutes(app, { store });

  return app;
}
