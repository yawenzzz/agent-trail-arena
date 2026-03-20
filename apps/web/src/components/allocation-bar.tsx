"use client";

import React from "react";

interface AllocationBarProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly max?: number;
}

export function AllocationBar({ label, value, onChange, max = 100 }: AllocationBarProps) {
  const width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;

  return (
    <label className="allocation-bar">
      <div className="allocation-bar__header">
        <span>{label}</span>
        <span>{value} pts</span>
      </div>
      <div className="allocation-bar__track" aria-hidden="true">
        <div className="allocation-bar__fill" style={{ width }} />
      </div>
      <input
        aria-label={label}
        max={max}
        min={0}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={1}
        type="range"
        value={value}
      />
    </label>
  );
}
