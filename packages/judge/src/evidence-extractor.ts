import type { EvidenceAnchor, RunEvent } from "@openclaw/domain";

export interface ExtractEvidenceAnchorsInput {
  readonly runId: string;
  readonly events: readonly RunEvent[];
}

export function extractEvidenceAnchors(
  input: ExtractEvidenceAnchorsInput
): readonly EvidenceAnchor[] {
  return input.events.map((event, eventIndex) => ({
    anchorId: `${input.runId}:event:${eventIndex}`,
    runId: input.runId,
    eventType: event.type,
    eventIndex,
    summary: summarizeRunEvent(event)
  }));
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

function readCommand(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || !("cmd" in input)) {
    return undefined;
  }

  const { cmd } = input as { cmd?: unknown };
  return typeof cmd === "string" ? cmd : undefined;
}
