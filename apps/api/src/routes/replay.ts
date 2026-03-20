import type { FastifyInstance } from "fastify";
import type { RunStore } from "../../../../packages/orchestrator/src/index.js";

interface ReplayRouteOptions {
  readonly store: RunStore;
}

export function registerReplayRoutes(
  app: FastifyInstance,
  options: ReplayRouteOptions
) {
  app.get("/runs/:runId/replay", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = options.store.getRun(runId);

    if (!run) {
      reply.code(404);
      return {
        message: `Unknown run: ${runId}`
      };
    }

    return run.replay;
  });
}
