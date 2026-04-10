import type { FastifyInstance } from "fastify";
import { createTrialProfile } from "../../../../packages/domain/src/index.js";
import {
  startRun,
  streamRun,
  type RunStore
} from "../../../../packages/orchestrator/src/index.js";
import { scenarioRegistry } from "../../../../packages/registry/src/index.js";
import type {
  CodexRunner,
  ScriptedAgentName,
  OpenClawGateway
} from "../../../../packages/sandbox/src/index.js";
import type { OpenClawConfig } from "../config/openclaw.js";
import { formatSseEvent } from "../lib/sse.js";

interface RunRouteOptions {
  readonly store: RunStore;
  readonly openClawConfig: OpenClawConfig;
  readonly createOpenClawGateway: (config: OpenClawConfig) => OpenClawGateway;
  readonly createCodexRunner: () => CodexRunner;
}

type CreateRunRuntime =
  | {
      readonly kind: "scripted";
      readonly agentName: ScriptedAgentName;
    }
  | {
      readonly kind: "openclaw";
      readonly workspaceRoot: string;
      readonly agentId: string;
    }
  | {
      readonly kind: "provider-agent";
      readonly provider: "openclaw" | "codex";
      readonly workspaceRoot: string;
      readonly agentId: string;
    };

interface CreateRunBody {
  readonly agentVersion: string;
  readonly build: Parameters<typeof createTrialProfile>[0]["build"];
  readonly judgeConfigVersion: string;
  readonly seed: string;
  readonly runtime?: CreateRunRuntime;
  readonly agentName?: ScriptedAgentName;
}

function readRuntime(
  body: CreateRunBody
):
  | {
      readonly kind: "scripted";
      readonly agentName: ScriptedAgentName;
    }
  | {
      readonly kind: "provider-agent";
      readonly provider: "openclaw" | "codex";
      readonly workspaceRoot: string;
      readonly agentId: string;
    } {
  if (body.runtime) {
    if (body.runtime.kind === "openclaw") {
      return {
        kind: "provider-agent",
        provider: "openclaw",
        workspaceRoot: body.runtime.workspaceRoot,
        agentId: body.runtime.agentId
      };
    }

    return body.runtime;
  }

  if (body.agentName) {
    return {
      kind: "scripted",
      agentName: body.agentName
    };
  }

  throw new Error("Run runtime is required.");
}

export function registerRunRoutes(app: FastifyInstance, options: RunRouteOptions) {
  app.post("/runs", async (request, reply) => {
    const body = request.body as CreateRunBody;
    const runtime = readRuntime(body);
    const profile = createTrialProfile({
      agentVersion: body.agentVersion,
      build: body.build,
      scenarioRegistryVersion: scenarioRegistry.version,
      judgeConfigVersion: body.judgeConfigVersion,
      seed: body.seed
    });
    const runtimeTarget =
      runtime.kind === "scripted"
        ? runtime
        : runtime.provider === "openclaw"
          ? {
              kind: "provider-agent" as const,
              provider: "openclaw" as const,
              workspaceRoot: runtime.workspaceRoot,
              agentId: runtime.agentId,
              gateway: options.createOpenClawGateway(options.openClawConfig)
            }
          : {
              kind: "provider-agent" as const,
              provider: "codex" as const,
              workspaceRoot: runtime.workspaceRoot,
              agentId: runtime.agentId,
              runner: options.createCodexRunner()
            };
    const run = await startRun({
      store: options.store,
      profile,
      registry: scenarioRegistry,
      runtime: runtimeTarget
    });

    reply.code(201);
    return run;
  });

  app.get("/runs/:runId", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = options.store.getRun(runId);

    if (!run) {
      reply.code(404);
      return {
        message: `Unknown run: ${runId}`
      };
    }

    const { runAnalysis: _runAnalysis, gradeAssessment: _gradeAssessment, ...summary } = run;
    return summary;
  });

  app.get("/runs/:runId/events", async (request, reply) => {
    const { runId } = request.params as { runId: string };

    try {
      const chunks = [];
      for await (const event of streamRun({
        store: options.store,
        runId
      })) {
        chunks.push(formatSseEvent(event));
      }

      reply.header("content-type", "text/event-stream; charset=utf-8");
      return chunks.join("");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Unknown run:")) {
        reply.code(404);
        return {
          message: error.message
        };
      }

      throw error;
    }
  });
}
