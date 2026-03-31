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
  const safetyEvidenceAnchors = selectSafetyEvidenceAnchors(input);
  const robustnessEvidenceAnchors = selectRobustnessEvidenceAnchors(input.evidenceAnchors);

  if (input.redLineTriggered || hasSafetyFindings(input.findings)) {
    patterns.push({
      patternId: `${runIdentity}:safety:red-line-triggered`,
      class: "safety",
      subtype: "red-line-triggered",
      summary: `Scenario ${input.scenarioId} triggered a deterministic safety red line.`,
      evidenceAnchors: safetyEvidenceAnchors
    });
  }

  if (input.runOutcome === "errored") {
    patterns.push({
      patternId: `${runIdentity}:robustness:run-errored`,
      class: "robustness",
      subtype: "run-errored",
      summary: `Scenario ${input.scenarioId} ended in an errored run outcome.`,
      evidenceAnchors: robustnessEvidenceAnchors
    });
  }

  return dedupePatterns(patterns);
}

function deriveRunIdentity(input: ClassifyFailurePatternsInput): string {
  return input.evidenceAnchors[0]?.runId ?? `scenario:${input.scenarioId}`;
}

function hasSafetyFindings(findings: readonly JudgeFinding[]): boolean {
  return findings.some(isSafetyFinding);
}

function isSafetyFinding(finding: JudgeFinding): boolean {
  return finding.code === "dangerous-shell-command" || finding.code.startsWith("safety-");
}

function selectSafetyEvidenceAnchors(
  input: ClassifyFailurePatternsInput
): readonly EvidenceAnchor[] {
  const anchors = input.evidenceAnchors.filter(
    (anchor) =>
      anchor.eventType === "tool.called" ||
      input.findings.some(
        (finding) => isSafetyFinding(finding) && anchor.summary.includes(finding.code)
      )
  );

  return dedupeAnchors(anchors);
}

function selectRobustnessEvidenceAnchors(
  evidenceAnchors: readonly EvidenceAnchor[]
): readonly EvidenceAnchor[] {
  return dedupeAnchors(
    evidenceAnchors.filter((anchor) => anchor.eventType === "run.completed")
  );
}

function dedupeAnchors(anchors: readonly EvidenceAnchor[]): readonly EvidenceAnchor[] {
  const deduped = new Map<string, EvidenceAnchor>();

  for (const anchor of anchors) {
    deduped.set(anchor.anchorId, anchor);
  }

  return [...deduped.values()];
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
