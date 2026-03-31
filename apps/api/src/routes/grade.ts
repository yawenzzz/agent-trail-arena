import type { FastifyInstance } from "fastify";
import type { RunStore } from "../../../../packages/orchestrator/src/index.js";

interface GradeRouteOptions {
  readonly store: RunStore;
}

export function registerGradeRoutes(
  app: FastifyInstance,
  options: GradeRouteOptions
) {
  app.get("/runs/:runId/grade", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const run = options.store.getRun(runId);

    if (!run) {
      reply.code(404);
      return {
        message: `Unknown run: ${runId}`
      };
    }

    return run.gradeAssessment;
  });
}
