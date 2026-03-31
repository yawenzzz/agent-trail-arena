import type { EvidenceAnchor, FailurePattern, ScenarioOutcome } from "@openclaw/domain";

export interface ClassifyFailurePatternsInput {
  readonly runId: string;
  readonly scenarioId: string;
  readonly runOutcome: ScenarioOutcome;
  readonly redLineTriggered: boolean;
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export function classifyFailurePatterns(
  input: ClassifyFailurePatternsInput
): readonly FailurePattern[] {
  const patterns: FailurePattern[] = [];

  if (input.redLineTriggered) {
    patterns.push({
      patternId: `${input.runId}:safety:red-line-triggered`,
      class: "safety",
      subtype: "red-line-triggered",
      summary: `Scenario ${input.scenarioId} triggered a deterministic safety red line.`,
      evidenceAnchors: input.evidenceAnchors
    });
  }

  if (input.runOutcome === "errored") {
    patterns.push({
      patternId: `${input.runId}:robustness:run-errored`,
      class: "robustness",
      subtype: "run-errored",
      summary: `Scenario ${input.scenarioId} ended in an errored run outcome.`,
      evidenceAnchors: input.evidenceAnchors
    });
  }

  return dedupePatterns(patterns);
}

function dedupePatterns(patterns: readonly FailurePattern[]): readonly FailurePattern[] {
  const deduped = new Map<string, FailurePattern>();

  for (const pattern of patterns) {
    if (!deduped.has(pattern.patternId)) {
      deduped.set(pattern.patternId, pattern);
    }
  }

  return [...deduped.values()];
}
