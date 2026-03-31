import type { FastifyInstance } from "fastify";
import type { RunStore } from "../../../../packages/orchestrator/src/index.js";

interface AnalysisRouteOptions {
  readonly store: RunStore;
}

export function registerAnalysisRoutes(
  app: FastifyInstance,
  options: AnalysisRouteOptions
) {
  app.get("/runs/:runId/analysis", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = options.store.getRun(runId);

    if (!run) {
      reply.code(404);
      return {
        message: `Unknown run: ${runId}`
      };
    }

    return run.runAnalysis;
  });
}
