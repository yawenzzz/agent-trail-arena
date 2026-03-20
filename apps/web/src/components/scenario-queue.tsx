import React from "react";
import type { ScenarioDefinition } from "../lib/trial-types";

interface ScenarioQueueProps {
  readonly scenario: ScenarioDefinition;
}

export function ScenarioQueue({ scenario }: ScenarioQueueProps) {
  return (
    <section className="panel stack-md">
      <p className="eyebrow">Scenario</p>
      <h2>{scenario.title}</h2>
      <p className="muted">{scenario.goal}</p>
      <dl className="meta-list">
        <div>
          <dt>Type</dt>
          <dd>{scenario.type}</dd>
        </div>
        <div>
          <dt>Allowed tools</dt>
          <dd>{scenario.allowedTools.join(", ")}</dd>
        </div>
        <div>
          <dt>Targeted attributes</dt>
          <dd>{scenario.targetedAttributes.join(", ")}</dd>
        </div>
      </dl>
    </section>
  );
}
