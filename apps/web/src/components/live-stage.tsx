import React from "react";
import type { RunEvent } from "../lib/trial-types";

interface LiveStageProps {
  readonly events: readonly RunEvent[];
}

export function LiveStage({ events }: LiveStageProps) {
  return (
    <section className="panel stack-md">
      <p className="eyebrow">Live Stage</p>
      <h2>Execution timeline</h2>
      <div className="timeline">
        {events.map((event, index) => (
          <article className="timeline-item" key={`${event.type}-${index}`}>
            <p className="event-type">{event.type}</p>
            <p>{describeEvent(event)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function describeEvent(event: RunEvent): string {
  switch (event.type) {
    case "run.started":
      return `Run ${event.runId} started for scenario ${event.scenarioId}.`;
    case "agent.summary":
      return event.text;
    case "tool.called":
      return `${event.toolName} ${JSON.stringify(event.input)}`;
    case "judge.update":
      return event.summary;
    case "run.completed":
      return `${event.result.outcome} - ${event.result.summary}`;
  }
}
