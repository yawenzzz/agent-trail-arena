import React from "react";
import { LiveStage } from "../../../components/live-stage";
import { getReplay } from "../../../lib/api-client";

interface ReplayPageProps {
  readonly params: Promise<{
    runId: string;
  }>;
}

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { runId } = await params;
  const replay = await getReplay(runId);

  return (
    <main className="stack-lg">
      <section className="panel stack-md">
        <p className="eyebrow">Replay Timeline</p>
        <h1>Replay for {runId}</h1>
        <p className="muted">Review the deterministic event sequence captured for this run.</p>
      </section>
      <LiveStage events={replay.events} />
    </main>
  );
}
