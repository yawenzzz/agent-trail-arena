export const attributeNames = [
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
] as const;

export const attributeLevels = ["low", "medium", "high"] as const;

export type AttributeName = (typeof attributeNames)[number];
export type AttributeLevel = (typeof attributeLevels)[number];
export type DeclaredBuild = Partial<Record<AttributeName, AttributeLevel>>;

export interface BuildAttributeEntry {
  readonly attribute: AttributeName;
  readonly level: AttributeLevel;
}
