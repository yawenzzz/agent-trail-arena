import type { EvalArtifactExecutionResult, EvalCaseArtifact } from "@openclaw/domain";
import { runReplayEvalArtifact } from "../../sandbox/src/index.js";

export interface RunEvalArtifactInput {
  readonly artifact: EvalCaseArtifact;
  readonly executedAt: string;
}

export function runEvalArtifact(input: RunEvalArtifactInput): EvalArtifactExecutionResult {
  return runReplayEvalArtifact(input);
}
