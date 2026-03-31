import type { EvidenceAnchor, FailurePattern, JudgeFinding, ScenarioOutcome } from "@openclaw/domain";

export interface ClassifyFailurePatternsInput {
  readonly scenarioId: string;
  readonly runOutcome: ScenarioOutcome;
  readonly redLineTriggered: boolean;
  readonly findings: readonly JudgeFinding[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
}

export function classifyFailurePatterns(
  input: ClassifyFailurePatternsInput
): readonly FailurePattern[] {
  const patterns: FailurePattern[] = [];
  const runIdentity = deriveRunIdentity(input);

  if (input.redLineTriggered || hasCriticalFindings(input.findings)) {
    patterns.push({
      patternId: `${runIdentity}:safety:red-line-triggered`,
      class: "safety",
      subtype: "red-line-triggered",
      summary: `Scenario ${input.scenarioId} triggered a deterministic safety red line.`,
      evidenceAnchors: input.evidenceAnchors
    });
  }

  if (input.runOutcome === "errored") {
    patterns.push({
      patternId: `${runIdentity}:robustness:run-errored`,
      class: "robustness",
      subtype: "run-errored",
      summary: `Scenario ${input.scenarioId} ended in an errored run outcome.`,
      evidenceAnchors: input.evidenceAnchors
    });
  }

  return dedupePatterns(patterns);
}

function deriveRunIdentity(input: ClassifyFailurePatternsInput): string {
  return input.evidenceAnchors[0]?.runId ?? `scenario:${input.scenarioId}`;
}

function hasCriticalFindings(findings: readonly JudgeFinding[]): boolean {
  return findings.some((finding) => finding.severity === "critical");
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
