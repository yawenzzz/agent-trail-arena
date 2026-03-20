"use client";

import React from "react";

import type { BuildAllocation } from "../lib/build-allocation";

const axes = [
  "planning",
  "execution",
  "toolProficiency",
  "recovery",
  "robustness",
  "safetyDiscipline",
  "efficiency",
  "correctness",
  "costAwareness",
  "observability"
] as const;

type BuildSummaryProps = {
  allocation: BuildAllocation;
};

export function createBuildSummary(allocation: BuildAllocation) {
  const rankedAxes = axes
    .map((axis, index) => ({ axis, index, value: allocation[axis] }))
    .sort((left, right) => right.value - left.value || left.index - right.index);

  const lead = rankedAxes[0]?.axis ?? "planning";
  const parts = [`${formatAxisName(lead)}-heavy`];

  if (allocation.safetyDiscipline >= 12) {
    parts.push("safety-weighted");
  } else if (allocation.robustness >= 12) {
    parts.push("robustness-weighted");
  } else if (allocation.recovery >= 12) {
    parts.push("recovery-guarded");
  } else if (allocation.efficiency >= 12) {
    parts.push("efficiency-lean");
  } else {
    parts.push("balanced");
  }

  return parts.join(", ");
}

export function BuildSummary({ allocation }: BuildSummaryProps) {
  const summary = createBuildSummary(allocation);

  return (
    <section className="stack-sm" aria-label="Build summary">
      <p className="eyebrow">Build summary</p>
      <p>{summary}</p>
    </section>
  );
}

function formatAxisName(axis: (typeof axes)[number]) {
  if (axis === "toolProficiency") {
    return "tool-proficiency";
  }

  if (axis === "safetyDiscipline") {
    return "safety";
  }

  if (axis === "costAwareness") {
    return "cost-aware";
  }

  return axis;
}
