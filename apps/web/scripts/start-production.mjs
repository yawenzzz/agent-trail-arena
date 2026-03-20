import { spawn } from "node:child_process";
import path from "node:path";
import { prepareNextServerArtifacts } from "./prepare-next-server.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");

await prepareNextServerArtifacts(appRoot);

const child = spawn(
  process.execPath,
  [path.join(appRoot, "node_modules", "next", "dist", "bin", "next"), "start", ...process.argv.slice(2)],
  {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
