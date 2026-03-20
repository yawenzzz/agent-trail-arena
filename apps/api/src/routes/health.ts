import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    scaffold: false,
    status: "ok"
  }));
}
