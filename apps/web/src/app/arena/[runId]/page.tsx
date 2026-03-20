import React from "react";
import { JudgePanel } from "../../../components/judge-panel";
import { LiveStage } from "../../../components/live-stage";
import { ResultCard } from "../../../components/result-card";
import { ScenarioQueue } from "../../../components/scenario-queue";
import { getRunEvents, getRunSummary } from "../../../lib/api-client";

interface ArenaPageProps {
  readonly params: Promise<{
    runId: string;
  }>;
}

export default async function ArenaPage({ params }: ArenaPageProps) {
  const { runId } = await params;
  const [summary, events] = await Promise.all([getRunSummary(runId), getRunEvents(runId)]);
  const result = events.find((event) => event.type === "run.completed");

  return (
    <main className="stack-lg">
      <section className="summary-grid">
        <ResultCard
          runId={runId}
          result={result?.type === "run.completed" ? result.result : undefined}
        />
        <JudgePanel
          admission={summary.admission}
          judge={summary.judge}
          measuredProfile={summary.measuredProfile}
        />
      </section>
      <section className="arena-layout">
        <ScenarioQueue scenario={summary.scenario} />
        <LiveStage events={events} />
        <JudgePanel
          admission={summary.admission}
          judge={summary.judge}
          measuredProfile={summary.measuredProfile}
        />
      </section>
    </main>
  );
}
