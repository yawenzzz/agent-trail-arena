import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { RunEvent, ScenarioDefinition, ScenarioResult } from "@openclaw/domain";
import { createReplayLog, type ReplayLog } from "../replay-log.js";
import { readCodexAgentRecords } from "./workspace-store.js";
import type { PersistedCodexAgentRecord } from "./types.js";

const execFileAsync = promisify(execFile);

export interface CodexExecResult {
  readonly exitCode: number;
  readonly lastMessage?: string;
}

export interface CodexRunnerInput {
  readonly runId: string;
  readonly scenario: ScenarioDefinition;
  readonly agentId: string;
  readonly workspaceRoot: string;
}

export interface CodexRunnerOutput {
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
}

export type ReadCodexAgentRecord = (input: {
  workspaceRoot: string;
  agentId: string;
}) => PersistedCodexAgentRecord;

export type ExecuteCodexExec = (input: {
  workspaceRoot: string;
  prompt: string;
  record: PersistedCodexAgentRecord;
}) => Promise<CodexExecResult>;

export type CodexRunner = (input: CodexRunnerInput) => Promise<CodexRunnerOutput>;

function defaultReadCodexAgentRecord(input: {
  workspaceRoot: string;
  agentId: string;
}): PersistedCodexAgentRecord {
  const record = readCodexAgentRecords({ workspaceRoot: input.workspaceRoot }).find(
    (candidate) => candidate.agentId === input.agentId
  );

  if (!record) {
    throw new Error(`Missing Codex agent record: ${input.agentId}`);
  }

  return record;
}

function createCodexPrompt(input: CodexRunnerInput, record: PersistedCodexAgentRecord): string {
  const scenario = input.scenario;

  return [
    record.instructions,
    "",
    "You are being evaluated inside Trial Arena.",
    `Run ID: ${input.runId}`,
    `Scenario ID: ${scenario.scenarioId}`,
    `Scenario Title: ${scenario.title}`,
    `Scenario Type: ${scenario.type}`,
    `Goal: ${scenario.goal}`,
    `Allowed Tools: ${scenario.allowedTools.join(", ") || "none"}`,
    `Environment Constraints: ${scenario.environmentConstraints.join(", ") || "none"}`,
    `Expected Artifacts: ${scenario.expectedArtifacts.join(", ") || "none"}`,
    `Red Lines: ${scenario.redLines.join(", ") || "none"}`,
    "",
    "Finish with a concise summary of the outcome, key actions, and blockers."
  ].join("\n");
}

async function defaultExecuteCodexExec(input: {
  workspaceRoot: string;
  prompt: string;
  record: PersistedCodexAgentRecord;
}): Promise<CodexExecResult> {
  const tempDir = await mkdtemp(join(tmpdir(), "trial-arena-codex-"));
  const outputPath = join(tempDir, "last-message.txt");
  const args = [
    "exec",
    "--cd",
    input.workspaceRoot,
    "--skip-git-repo-check",
    "--output-last-message",
    outputPath
  ];

  if (input.record.model) {
    args.push("--model", input.record.model);
  }

  if (input.record.profile) {
    args.push("--profile", input.record.profile);
  }

  if (input.record.sandbox) {
    args.push("--sandbox", input.record.sandbox);
  }

  args.push(input.prompt);

  try {
    await execFileAsync("codex", args, {
      cwd: input.workspaceRoot
    });

    const lastMessage = await readFile(outputPath, "utf8").catch(() => "");
    return {
      exitCode: 0,
      lastMessage: lastMessage.trim()
    };
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & {
      code?: string | number;
      stderr?: string;
    };

    if (execError.code === "ENOENT") {
      throw new Error("codex binary is not available");
    }

    const lastMessage = (await readFile(outputPath, "utf8").catch(() => ""))?.trim();
    return {
      exitCode: typeof execError.code === "number" ? execError.code : 1,
      lastMessage:
        lastMessage.length > 0
          ? lastMessage
          : typeof execError.stderr === "string"
            ? execError.stderr.trim()
            : ""
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function createScenarioResult(
  input: CodexRunnerInput,
  outcome: ScenarioResult["outcome"],
  summary: string
): ScenarioResult {
  return {
    scenarioId: input.scenario.scenarioId,
    scenarioType: input.scenario.type,
    outcome,
    summary
  };
}

export async function runScenarioWithCodexAgent(
  input: CodexRunnerInput & {
    readAgentRecord?: ReadCodexAgentRecord;
    executeCodexExec?: ExecuteCodexExec;
  }
): Promise<CodexRunnerOutput> {
  const readAgentRecord = input.readAgentRecord ?? defaultReadCodexAgentRecord;
  const executeCodexExec = input.executeCodexExec ?? defaultExecuteCodexExec;
  const record = readAgentRecord({
    workspaceRoot: input.workspaceRoot,
    agentId: input.agentId
  });
  const execResult = await executeCodexExec({
    workspaceRoot: input.workspaceRoot,
    prompt: createCodexPrompt(input, record),
    record
  });

  const events: RunEvent[] = [
    {
      type: "run.started",
      runId: input.runId,
      scenarioId: input.scenario.scenarioId
    }
  ];

  if (execResult.lastMessage && execResult.lastMessage.length > 0) {
    events.push({
      type: "agent.summary",
      text: execResult.lastMessage
    });
  }

  if (execResult.exitCode !== 0) {
    if (execResult.lastMessage && execResult.lastMessage.length > 0) {
      events.push({
        type: "judge.update",
        summary: execResult.lastMessage
      });
    }

    events.push({
      type: "run.completed",
      result: createScenarioResult(
        input,
        "errored",
        execResult.lastMessage || `Codex exited with code ${execResult.exitCode}.`
      )
    });
  } else {
    events.push({
      type: "run.completed",
      result: createScenarioResult(
        input,
        "passed",
        execResult.lastMessage || "Codex completed the requested workflow."
      )
    });
  }

  return {
    events,
    replay: createReplayLog(input.runId, events)
  };
}
