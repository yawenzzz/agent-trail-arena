import React from "react";
import Link from "next/link";
import type { ScenarioResult } from "../lib/trial-types";

interface ResultCardProps {
  readonly runId: string;
  readonly result: ScenarioResult | undefined;
}

export function ResultCard({ runId, result }: ResultCardProps) {
  return (
    <section className="panel stack-md">
      <p className="eyebrow">Scenario Result</p>
      <h2>{result?.outcome ?? "pending"}</h2>
      <p className="muted">{result?.summary ?? "Waiting for completion."}</p>
      <Link className="secondary-link" href={`/replay/${runId}`}>
        Open replay
      </Link>
    </section>
  );
}
