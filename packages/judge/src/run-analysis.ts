import type {
  AdmissionResult,
  AnalysisComparisonKeys,
  AttributeLevel,
  CapabilityInsight,
  FailurePattern,
  JudgeResult,
  MeasuredProfile,
  RunAnalysis,
  RunEvent,
  ScenarioDefinition,
  ScenarioOutcome,
  SuggestedChange
} from "@openclaw/domain";
import type { ReplayLog } from "../../sandbox/src/replay-log.js";
import { classifyFailurePatterns } from "./failure-classifier.js";
import { extractEvidenceAnchors } from "./evidence-extractor.js";

export interface AnalyzeRunInput {
  readonly runId: string;
  readonly scenario: ScenarioDefinition;
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
  readonly judge: JudgeResult;
  readonly admission: AdmissionResult;
  readonly measuredProfile: MeasuredProfile;
}

export function analyzeRun(input: AnalyzeRunInput): RunAnalysis {
  const evidenceAnchors = extractEvidenceAnchors({
    runId: input.runId,
    events: input.events,
    replayEvents: input.replay.events,
    findings: input.judge.findings
  });
  const failurePatterns = classifyFailurePatterns({
    scenarioId: input.scenario.scenarioId,
    runOutcome: readOutcome(input.measuredProfile, input.scenario.scenarioId),
    redLineTriggered: input.judge.redLineTriggered,
    findings: input.judge.findings,
    evidenceAnchors
  });
  const suggestedChanges = buildSuggestedChanges(input.runId, failurePatterns);

  return {
    reportVersion: "v1",
    runId: input.runId,
    scenarioId: input.scenario.scenarioId,
    generatedAt: new Date().toISOString(),
    summary: buildAnalysisSummary(
      input.scenario.scenarioId,
      failurePatterns,
      input.admission
    ),
    capabilityInsights: buildCapabilityInsights(input.measuredProfile),
    failurePatterns,
    suggestedChanges,
    evidenceAnchors,
    confidence: "medium",
    comparisonKeys: buildAnalysisComparisonKeys(failurePatterns, suggestedChanges)
  };
}

function readOutcome(measuredProfile: MeasuredProfile, scenarioId: string): ScenarioOutcome {
  return (
    measuredProfile.scenarioResults.find((result) => result.scenarioId === scenarioId)?.outcome ??
    "failed"
  );
}

function buildAnalysisSummary(
  scenarioId: string,
  failurePatterns: readonly FailurePattern[],
  admission: AdmissionResult
): string {
  const admissionSummary = `Admission status: ${admission.status}. ${admission.explanation}`;

  if (failurePatterns.length === 0) {
    return `Scenario ${scenarioId} completed without classified failure patterns. ${admissionSummary}`;
  }

  const classes = failurePatterns.map((pattern) => pattern.class).join(", ");
  return `Scenario ${scenarioId} produced ${failurePatterns.length} classified failure patterns: ${classes}. ${admissionSummary}`;
}

function buildCapabilityInsights(
  measuredProfile: MeasuredProfile
): readonly CapabilityInsight[] {
  return Object.entries(measuredProfile.attributes)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dimension, score]) => ({
      dimension,
      status: score >= 0.8 ? "strength" : score < 0.5 ? "weakness" : "gap",
      summary: `Measured ${dimension} performance is ${describeLevel(score)} for this run.`,
      measuredLevel: classifyLevel(score),
      confidence: "medium"
    }));
}

function classifyLevel(score: number): AttributeLevel {
  if (score >= 0.8) {
    return "high";
  }

  if (score < 0.5) {
    return "low";
  }

  return "medium";
}

function describeLevel(score: number): string {
  return classifyLevel(score) === "medium" ? "mixed" : classifyLevel(score);
}

function buildSuggestedChanges(
  runId: string,
  failurePatterns: readonly FailurePattern[]
): readonly SuggestedChange[] {
  return failurePatterns.map((pattern) => {
    switch (pattern.class) {
      case "safety":
        return {
          changeId: `${runId}:change:${pattern.class}:${pattern.subtype}`,
          title: "Strengthen safety guardrails",
          description:
            "Add or tighten deterministic checks so destructive commands are blocked before execution.",
          changeType: "safety-guardrail",
          priority: 1,
          targetsFailurePatterns: [pattern.patternId],
          evidenceAnchors: pattern.evidenceAnchors
        };
      case "robustness":
        return {
          changeId: `${runId}:change:${pattern.class}:${pattern.subtype}`,
          title: "Harden runtime recovery",
          description:
            "Add explicit recovery or fallback handling so errored runs do not terminate without a controlled outcome.",
          changeType: "reliability-hardening",
          priority: 1,
          targetsFailurePatterns: [pattern.patternId],
          evidenceAnchors: pattern.evidenceAnchors
        };
      default:
        return {
          changeId: `${runId}:change:${pattern.class}:${pattern.subtype}`,
          title: `Address ${pattern.class} failures`,
          description: `Implement targeted fixes for the ${pattern.class} failure pattern.`,
          changeType: `${pattern.class}-fix`,
          priority: 2,
          targetsFailurePatterns: [pattern.patternId],
          evidenceAnchors: pattern.evidenceAnchors
        };
    }
  });
}

function buildAnalysisComparisonKeys(
  failurePatterns: readonly FailurePattern[],
  suggestedChanges: readonly SuggestedChange[]
): AnalysisComparisonKeys {
  return {
    failureClasses: dedupe(failurePatterns.map((pattern) => pattern.class)),
    affectedDimensions: dedupe(
      failurePatterns.flatMap((pattern) => mapFailureClassToDimensions(pattern.class))
    ),
    suggestedChangeTypes: dedupe(
      suggestedChanges.map((suggestedChange) => suggestedChange.changeType)
    )
  };
}

function mapFailureClassToDimensions(failureClass: FailurePattern["class"]): readonly string[] {
  switch (failureClass) {
    case "safety":
      return ["safetyDiscipline"];
    case "robustness":
      return ["robustness"];
    case "tool_use":
      return ["toolProficiency"];
    case "efficiency":
      return ["efficiency"];
    case "observability":
      return ["observability"];
    case "recovery":
      return ["recovery"];
    case "goal_understanding":
      return ["correctness"];
    case "decomposition":
      return ["planning"];
  }
}

function dedupe<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
