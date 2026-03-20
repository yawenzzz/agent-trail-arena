import { describe, expect, it } from "vitest";

import {
  createDefaultAllocation,
  rebalanceAllocation,
  toDeclaredBuild,
  type BuildAllocation
} from "./build-allocation";

function sumAllocation(allocation: BuildAllocation): number {
  return Object.values(allocation).reduce((total, value) => total + value, 0);
}

describe("createDefaultAllocation", () => {
  it("seeds a default allocation that always totals 100", () => {
    const allocation = createDefaultAllocation();
    const expectedAllocation: BuildAllocation = {
      planning: 10,
      execution: 10,
      toolProficiency: 9,
      recovery: 9,
      efficiency: 7,
      correctness: 9,
      robustness: 14,
      safetyDiscipline: 14,
      costAwareness: 8,
      observability: 10,
    };

    expect(allocation).toEqual(expectedAllocation);
    expect(sumAllocation(allocation)).toBe(100);
    expect(allocation.robustness).toBeGreaterThan(allocation.costAwareness);
  });
});

describe("rebalanceAllocation", () => {
  it("rebalances other non-zero attributes proportionally when one attribute increases", () => {
    const allocation = createDefaultAllocation();
    const next = rebalanceAllocation(allocation, "planning", 40);

    expect(sumAllocation(next)).toBe(100);
    expect(next.planning).toBe(40);
    expect(next.robustness).toBeLessThan(allocation.robustness);
    expect(Object.values(next).every((value) => value >= 0)).toBe(true);
  });

  it("keeps the total at 100 when a target decreases", () => {
    const allocation = createDefaultAllocation();
    const next = rebalanceAllocation(allocation, "planning", 5);

    expect(sumAllocation(next)).toBe(100);
    expect(next.planning).toBe(5);
    expect(next.execution).toBeGreaterThan(allocation.execution);
    expect(Object.values(next).every((value) => value >= 0)).toBe(true);
  });

  it("clamps target values below 0 and above 100", () => {
    const allocation = createDefaultAllocation();
    const belowZero = rebalanceAllocation(allocation, "planning", -12);
    const aboveHundred = rebalanceAllocation(allocation, "planning", 130);

    expect(belowZero.planning).toBe(0);
    expect(sumAllocation(belowZero)).toBe(100);
    expect(aboveHundred.planning).toBe(100);
    expect(sumAllocation(aboveHundred)).toBe(100);
  });

  it("uses the zero-total fallback path without dropping the total below 100", () => {
    const allocation = {
      planning: 100,
      execution: 0,
      toolProficiency: 0,
      recovery: 0,
      efficiency: 0,
      correctness: 0,
      robustness: 0,
      safetyDiscipline: 0,
      costAwareness: 0,
      observability: 0
    };

    const next = rebalanceAllocation(allocation, "planning", 40);

    expect(sumAllocation(next)).toBe(100);
    expect(next.planning).toBe(40);
    expect(next.execution).toBeGreaterThan(0);
    expect(next.robustness).toBeGreaterThan(0);
  });
});

describe("toDeclaredBuild", () => {
  it("maps numeric allocation into the existing createRun build payload", () => {
    const payload = toDeclaredBuild({
      planning: 40,
      execution: 18,
      toolProficiency: 14,
      recovery: 10,
      efficiency: 4,
      correctness: 4,
      robustness: 4,
      safetyDiscipline: 4,
      costAwareness: 1,
      observability: 1
    });

    expect(payload.planning).toBe("high");
    expect(payload.execution).toBe("medium");
    expect(payload.costAwareness).toBe("low");
  });

  it("respects threshold boundaries at 10 and 25", () => {
    const payload = toDeclaredBuild({
      planning: 9,
      execution: 10,
      toolProficiency: 24,
      recovery: 25,
      efficiency: 1,
      correctness: 1,
      robustness: 1,
      safetyDiscipline: 1,
      costAwareness: 1,
      observability: 1
    });

    expect(payload.planning).toBe("low");
    expect(payload.execution).toBe("medium");
    expect(payload.toolProficiency).toBe("medium");
    expect(payload.recovery).toBe("high");
  });
});
