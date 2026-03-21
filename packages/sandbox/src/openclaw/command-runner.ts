import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OpenClawCommandInput } from "./types.js";

const execFileAsync = promisify(execFile);

function buildCommandString(args: readonly string[]): string {
  return ["openclaw", ...args].join(" ");
}

async function executeOpenClawCommandWithOutput(
  input: OpenClawCommandInput
): Promise<{ stdout: string; stderr: string }> {
  const command = buildCommandString(input.args);

  try {
    const result = await execFileAsync("openclaw", [...input.args], {
      cwd: input.cwd,
      encoding: "utf8",
      env: input.env ? { ...process.env, ...input.env } : process.env
    });

    return {
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : ""
    };
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

export async function executeOpenClawCommand(
  input: OpenClawCommandInput
): Promise<void> {
  await executeOpenClawCommandWithOutput(input);
}

export async function executeOpenClawJsonCommand<T>(
  input: OpenClawCommandInput
): Promise<T> {
  const command = buildCommandString(input.args);
  const { stdout } = await executeOpenClawCommandWithOutput(input);

  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    throw new Error(
      `OpenClaw command returned invalid JSON (${command}): ${
        error instanceof Error ? error.message : "unknown parse error"
      }`
    );
  }
}
