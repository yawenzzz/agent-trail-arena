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

const axisLabels: Record<(typeof axes)[number], string> = {
  planning: "Planning",
  execution: "Execution",
  toolProficiency: "Tool proficiency",
  recovery: "Recovery",
  robustness: "Robustness",
  safetyDiscipline: "Safety discipline",
  efficiency: "Efficiency",
  correctness: "Correctness",
  costAwareness: "Cost awareness",
  observability: "Observability"
};

type BuildRadarChartProps = {
  allocation: BuildAllocation;
};

export function BuildRadarChart({ allocation }: BuildRadarChartProps) {
  const size = 240;
  const center = size / 2;
  const radius = 88;

  function toPoint(value: number, index: number) {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    const distance = radius * (value / 100);

    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance
    };
  }

  function toPolygonPoints(scale: number) {
    return axes
      .map((axis, index) => {
        const point = toPoint(allocation[axis] * scale, index);
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      })
      .join(" ");
  }

  const polygonPoints = toPolygonPoints(1);

  return (
    <section className="stack-sm" aria-label="Build shape">
      <div className="stack-sm">
        <p className="eyebrow">Build shape</p>
        <svg
          aria-label="Build radar chart"
          role="img"
          viewBox={`0 0 ${size} ${size}`}
          width="100%"
          height="240"
        >
          <polygon
            fill="none"
            points={toPolygonPoints(0.33)}
            stroke="currentColor"
            strokeOpacity="0.18"
          />
          <polygon
            fill="none"
            points={toPolygonPoints(0.66)}
            stroke="currentColor"
            strokeOpacity="0.18"
          />
          <polygon fill="none" points={toPolygonPoints(1)} stroke="currentColor" strokeOpacity="0.18" />
          {axes.map((axis, index) => {
            const endpoint = toPoint(100, index);
            return (
              <line
                key={axis}
                x1={center}
                x2={endpoint.x}
                y1={center}
                y2={endpoint.y}
                stroke="currentColor"
                strokeOpacity="0.14"
              />
            );
          })}
          <polygon
            fill="currentColor"
            fillOpacity="0.16"
            points={polygonPoints}
            stroke="currentColor"
            strokeLinejoin="round"
          />
          {axes.map((axis, index) => {
            const endpoint = toPoint(112, index);
            const isLeft = endpoint.x < center - 4;
            const isTop = endpoint.y < center - 4;

            return (
              <text
                key={axis}
                x={endpoint.x}
                y={endpoint.y}
                fill="currentColor"
                fontSize="8"
                textAnchor={isLeft ? "end" : "start"}
                dominantBaseline={isTop ? "auto" : "hanging"}
              >
                {axisLabels[axis]}
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
