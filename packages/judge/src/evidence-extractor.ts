import type { EvidenceAnchor, JudgeFinding, RunEvent } from "@openclaw/domain";

export interface ExtractEvidenceAnchorsInput {
  readonly runId: string;
  readonly events?: readonly RunEvent[];
  readonly replayEvents?: readonly RunEvent[];
  readonly findings?: readonly JudgeFinding[];
}

export function extractEvidenceAnchors(
  input: ExtractEvidenceAnchorsInput
): readonly EvidenceAnchor[] {
  const eventAnchors = (input.events ?? []).map((event, eventIndex) =>
    buildEventAnchor(input.runId, event, eventIndex, "event")
  );
  const replayAnchors = (input.replayEvents ?? []).map((event, eventIndex) =>
    buildEventAnchor(input.runId, event, eventIndex, "replay")
  );
  const findingAnchors = (input.findings ?? []).map((finding, findingIndex) => ({
    anchorId: `${input.runId}:finding:${findingIndex}`,
    runId: input.runId,
    summary: summarizeFinding(finding)
  }));

  return [...eventAnchors, ...replayAnchors, ...findingAnchors];
}

function buildEventAnchor(
  runId: string,
  event: RunEvent,
  eventIndex: number,
  sourceKind: "event" | "replay"
): EvidenceAnchor {
  const summary = summarizeRunEvent(event);

  return {
    anchorId: `${runId}:${sourceKind}:${eventIndex}`,
    runId,
    eventType: event.type,
    eventIndex,
    summary: sourceKind === "replay" ? `Replay event: ${summary}` : summary
  };
}

function summarizeRunEvent(event: RunEvent): string {
  switch (event.type) {
    case "run.started":
      return `Run started for scenario ${event.scenarioId}.`;
    case "agent.summary":
      return `Agent summary: ${event.text}`;
    case "tool.called": {
      const command = readCommand(event.input);
      return command
        ? `Tool ${event.toolName} called with command: ${command}.`
        : `Tool ${event.toolName} called.`;
    }
    case "judge.update":
      return `Judge update: ${event.summary}`;
    case "run.completed":
      return `Run completed with outcome ${event.result.outcome}.`;
  }
}

function summarizeFinding(finding: JudgeFinding): string {
  return `Judge finding ${finding.code} (${finding.severity}): ${finding.message}`;
}

function readCommand(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || !("cmd" in input)) {
    return undefined;
  }

  const { cmd } = input as { cmd?: unknown };
  return typeof cmd === "string" ? cmd : undefined;
}
