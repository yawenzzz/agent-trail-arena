import Fastify from "fastify";

export function buildServer() {
  const app = Fastify();

  app.get("/health", async () => ({
    scaffold: true,
    status: "ok"
  }));

  return app;
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === new URL(process.argv[1], "file:").href;

if (isEntrypoint) {
  const app = buildServer();

  app.listen({ host: "0.0.0.0", port: 3001 }).catch((error) => {
    app.log.error(error);
    process.exitCode = 1;
  });
}
