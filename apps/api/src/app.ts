import Fastify from "fastify";
import {
  createInMemoryCapabilityImprovementStore,
  createFileBackedCapabilityImprovementStoreSync,
  createInMemoryRunStore
} from "../../../packages/orchestrator/src/index.js";
import {
  createCodexAgent,
  resolveCodexWorkspace,
  runScenarioWithCodexAgent,
  OpenClawGatewayClient,
  createOpenClawAgent,
  resolveOpenClawWorkspace,
  type CodexAgentDescriptor,
  type CodexRunner,
  type CreateOpenClawAgentInput,
  type OpenClawGateway,
  type ResolvedCodexWorkspace,
  type ResolvedOpenClawWorkspace
} from "../../../packages/sandbox/src/index.js";
import { readOpenClawConfig, type OpenClawConfig } from "./config/openclaw.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAnalysisRoutes } from "./routes/analysis.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerGradeRoutes } from "./routes/grade.js";
import { registerOpenClawRoutes } from "./routes/openclaw.js";
import { registerProductionFeedbackRoutes } from "./routes/production-feedback.js";
import { registerReplayRoutes } from "./routes/replay.js";
import { registerRunRoutes } from "./routes/runs.js";

interface BuildAppOptions {
  readonly store?: ReturnType<typeof createInMemoryRunStore>;
  readonly capabilityStore?: ReturnType<typeof createInMemoryCapabilityImprovementStore>;
  readonly capabilityStorePath?: string;
  readonly openClawConfig?: OpenClawConfig;
  readonly resolveOpenClawWorkspace?: (
    input: { stateRoot?: string; configPath?: string }
  ) => Promise<ResolvedOpenClawWorkspace>;
  readonly provisionOpenClawAgent?: (
    input: CreateOpenClawAgentInput
  ) => Promise<Awaited<ReturnType<typeof createOpenClawAgent>>>;
  readonly createOpenClawGateway?: (config: OpenClawConfig) => OpenClawGateway;
  readonly createCodexRunner?: () => CodexRunner;
  readonly resolveCodexWorkspace?: (
    input: { workspaceRoot: string }
  ) => ResolvedCodexWorkspace | Promise<ResolvedCodexWorkspace>;
  readonly provisionCodexAgent?: (
    input: { workspaceRoot: string; agentName: string }
  ) => CodexAgentDescriptor | Promise<CodexAgentDescriptor>;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const store = options.store ?? createInMemoryRunStore();
  const capabilityStorePath =
    options.capabilityStorePath ?? process.env.OPENCLAW_CAPABILITY_STORE_PATH;
  const capabilityStore =
    options.capabilityStore ??
    (typeof capabilityStorePath === "string" && capabilityStorePath.length > 0
      ? createFileBackedCapabilityImprovementStoreSync({
          stateFilePath: capabilityStorePath
        })
      : createInMemoryCapabilityImprovementStore());
  const openClawConfig = options.openClawConfig ?? readOpenClawConfig();
  const createOpenClawGateway =
    options.createOpenClawGateway ??
    ((config: OpenClawConfig) =>
      new OpenClawGatewayClient({
        url: config.gatewayUrl,
        token: config.gatewayToken,
        password: config.gatewayPassword
      }));
  const createCodexRunner = options.createCodexRunner ?? (() => runScenarioWithCodexAgent);

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
  registerAgentRoutes(app, {
    resolveOpenClawWorkspace: options.resolveOpenClawWorkspace ?? resolveOpenClawWorkspace,
    provisionOpenClawAgent: options.provisionOpenClawAgent ?? createOpenClawAgent,
    resolveCodexWorkspace: options.resolveCodexWorkspace ?? resolveCodexWorkspace,
    provisionCodexAgent: options.provisionCodexAgent ?? createCodexAgent
  });
  registerOpenClawRoutes(app, {
    resolveWorkspace: options.resolveOpenClawWorkspace ?? resolveOpenClawWorkspace,
    provisionAgent: options.provisionOpenClawAgent ?? createOpenClawAgent,
    capabilityStore
  });
  registerRunRoutes(app, { store, openClawConfig, createOpenClawGateway, createCodexRunner });
  registerProductionFeedbackRoutes(app, { capabilityStore });
  registerAnalysisRoutes(app, { store });
  registerGradeRoutes(app, { store });
  registerReplayRoutes(app, { store });

  return app;
}
