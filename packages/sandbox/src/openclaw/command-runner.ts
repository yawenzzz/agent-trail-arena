import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenClawCommandInput } from "./types.js";

const execFileAsync = promisify(execFile);

export async function executeOpenClawCommand(
  input: OpenClawCommandInput
): Promise<void> {
  const command = ["openclaw", ...input.args].join(" ");

  try {
    await execFileAsync("openclaw", [...input.args], {
      cwd: input.cwd,
      encoding: "utf8",
      env: input.env ? { ...process.env, ...input.env } : process.env
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      readonly stderr?: string | Buffer;
    };
    const stderr =
      typeof failure.stderr === "string"
        ? failure.stderr.trim()
        : Buffer.isBuffer(failure.stderr)
          ? failure.stderr.toString("utf8").trim()
          : "";
    const details = stderr || failure.message || "unknown error";

    throw new Error(`OpenClaw command failed (${command}): ${details}`);
  }
}
