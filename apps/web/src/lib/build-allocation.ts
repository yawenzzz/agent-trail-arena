import type { AttributeLevel, AttributeName, DeclaredBuild } from "./trial-types";

export type BuildAllocation = Record<AttributeName, number>;

const attributeNames = [
  "planning",
  "execution",
  "toolProficiency",
  "recovery",
  "efficiency",
  "correctness",
  "robustness",
  "safetyDiscipline",
  "costAwareness",
  "observability"
] as const satisfies readonly AttributeName[];

const TOTAL_ALLOCATION = 100;

export function createDefaultAllocation(): BuildAllocation {
  return {
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
}

export function rebalanceAllocation(
  allocation: BuildAllocation,
  target: AttributeName,
  nextValue: number
): BuildAllocation {
  const clampedTarget = clampAllocationValue(nextValue);
  const nextAllocation: BuildAllocation = {
    ...allocation,
    [target]: clampedTarget
  };

  const otherNames = attributeNames.filter((name) => name !== target);
  const currentOtherTotal = otherNames.reduce((total, name) => total + allocation[name], 0);
  const nextOtherTotal = TOTAL_ALLOCATION - clampedTarget;

  if (currentOtherTotal <= 0) {
    distributeEvenly(nextAllocation, otherNames, nextOtherTotal);
    return nextAllocation;
  }

  const scaledEntries = otherNames.map((name) => {
    const exactValue = (allocation[name] * nextOtherTotal) / currentOtherTotal;
    const wholeValue = Math.floor(exactValue);
    return {
      name,
      wholeValue,
      fraction: exactValue - wholeValue
    };
  });

  let remainder = nextOtherTotal - scaledEntries.reduce((total, entry) => total + entry.wholeValue, 0);

  const sortedEntries = scaledEntries.slice().sort((left, right) => right.fraction - left.fraction);
  for (let index = 0; index < remainder; index += 1) {
    sortedEntries[index].wholeValue += 1;
  }

  for (const { name, wholeValue } of scaledEntries) {
    nextAllocation[name] = wholeValue;
  }

  return nextAllocation;
}

export function toDeclaredBuild(allocation: BuildAllocation): DeclaredBuild {
  const build: DeclaredBuild = {};

  for (const name of attributeNames) {
    build[name] = toAttributeLevel(allocation[name]);
  }

  return build;
}

function clampAllocationValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(Math.round(value), 0), TOTAL_ALLOCATION);
}

function toAttributeLevel(value: number): AttributeLevel {
  if (value >= 25) {
    return "high";
  }

  if (value >= 10) {
    return "medium";
  }

  return "low";
}

function distributeEvenly(
  allocation: BuildAllocation,
  names: readonly AttributeName[],
  total: number
): void {
  const baseValue = Math.floor(total / names.length);
  let remainder = total - baseValue * names.length;

  for (const name of names) {
    allocation[name] = baseValue + (remainder > 0 ? 1 : 0);
    remainder -= 1;
  }
}
