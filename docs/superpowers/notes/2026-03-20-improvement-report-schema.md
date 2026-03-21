# Trial Arena Improvement Report Schema Notes

## Goal

Define a first structured schema for:

- `failurePattern`
- `suggestedChange`
- `improvementReport`

This note turns the product-direction discussion into a data contract that can later drive:

- judge outputs
- API payloads
- UI rendering
- replay evidence linking
- version comparison

## Design Principles

The schema should be:

- runtime-agnostic
- evidence-backed
- stable enough for version comparison
- simple enough for V1 implementation

The schema should support both:

- human-readable explanations
- machine-readable fields for aggregation and diffing

## Shared Primitive Types

Recommended shared enums for V1.

### ConfidenceLevel

- `high`
- `medium`
- `low`

### EvidenceMode

- `direct`
- `inferred`

### FailureSeverity

- `low`
- `medium`
- `high`
- `critical`

### FailureClass

- `goal_understanding`
- `decomposition`
- `tool_use`
- `recovery`
- `safety`
- `observability`
- `robustness`
- `efficiency`

### ChangeType

- `prompting`
- `tooling`
- `workflow`
- `guardrail`
- `reporting`
- `runtime`

### RetestType

- `same_scenario_family`
- `interruption_pack`
- `degraded_tool_pack`
- `safety_pack`
- `observability_pack`
- `robustness_pack`
- `regression_pack`

## Evidence Anchor

The schema needs a stable way to point back to run evidence.

```ts
interface EvidenceAnchor {
  readonly anchorId: string;
  readonly runId: string;
  readonly eventType?: string;
  readonly eventIndex?: number;
  readonly replayTimestampMs?: number;
  readonly summary: string;
}
```

Notes:

- `anchorId` should be stable within the report
- `eventIndex` is enough for V1 if event ids do not exist yet
- `summary` is the user-facing explanation of why this anchor matters

## Failure Pattern

This is the core diagnosis unit.

```ts
interface FailurePattern {
  readonly patternId: string;
  readonly class: FailureClass;
  readonly subtype: string;
  readonly severity: FailureSeverity;
  readonly evidenceMode: EvidenceMode;
  readonly confidence: ConfidenceLevel;
  readonly title: string;
  readonly description: string;
  readonly impact: string;
  readonly likelyCause: string;
  readonly affectedDimensions: readonly string[];
  readonly evidenceAnchors: readonly string[];
}
```

Field intent:

- `patternId`: stable identifier for comparison and UI keys
- `class`: top-level failure bucket
- `subtype`: narrower classification
- `severity`: how damaging or risky it was
- `evidenceMode`: whether this is direct or inferred
- `confidence`: how certain the system is
- `title`: short label for the UI
- `description`: what happened
- `impact`: why it matters
- `likelyCause`: what kind of weakness it suggests
- `affectedDimensions`: which capability dimensions this touches
- `evidenceAnchors`: links back to replay evidence

## Suggested Change

This is the main improvement unit.

```ts
interface SuggestedChange {
  readonly changeId: string;
  readonly title: string;
  readonly description: string;
  readonly priority: 1 | 2 | 3;
  readonly changeType: ChangeType;
  readonly reason: string;
  readonly expectedImpactDimensions: readonly string[];
  readonly targetsFailurePatterns: readonly string[];
  readonly recommendedRetest: RetestPlan;
}
```

Field intent:

- `priority`: forces ranking; `1` is the best next change
- `changeType`: tells the user what sort of engineering change this is
- `reason`: why this change is worth trying
- `expectedImpactDimensions`: what should improve if the change works
- `targetsFailurePatterns`: which diagnosed failures this addresses
- `recommendedRetest`: what kind of next validation should follow

## Retest Plan

```ts
interface RetestPlan {
  readonly type: RetestType;
  readonly rationale: string;
  readonly scenarioHints: readonly string[];
}
```

This gives the system a way to say:

- what to run next
- why that is the right next run

## Capability Insight

The report should interpret the graph, not just embed raw values.

```ts
interface CapabilityInsight {
  readonly dimension: string;
  readonly status: "strength" | "weakness" | "gap";
  readonly summary: string;
  readonly declaredLevel?: string;
  readonly measuredLevel?: string;
  readonly confidence: ConfidenceLevel;
}
```

Notes:

- `strength`: demonstrated strength
- `weakness`: measured weakness
- `gap`: declared vs measured mismatch

## Improvement Report

This is the full output artifact for one run.

```ts
interface ImprovementReport {
  readonly reportVersion: "v1";
  readonly runId: string;
  readonly scenarioId: string;
  readonly generatedAt: string;
  readonly summary: {
    readonly headline: string;
    readonly outcome: "passed" | "failed" | "errored";
    readonly readinessStatement: string;
    readonly topStrength: string;
    readonly topRisk: string;
  };
  readonly strengths: readonly CapabilityInsight[];
  readonly weaknesses: readonly CapabilityInsight[];
  readonly gaps: readonly CapabilityInsight[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
  readonly failurePatterns: readonly FailurePattern[];
  readonly suggestedChanges: readonly SuggestedChange[];
  readonly retestRecommendations: readonly RetestPlan[];
  readonly confidence: ConfidenceLevel;
}
```

## V1 Constraints

The first version should stay small.

Recommended practical limits:

- `strengths`: top 3
- `weaknesses`: top 3
- `gaps`: top 3
- `failurePatterns`: top 3
- `suggestedChanges`: top 3
- `retestRecommendations`: top 1 to 2

This keeps the report actionable instead of noisy.

## Derivation Rules

The schema should be filled using deterministic evidence where possible.

Suggested derivation order:

1. read terminal scenario outcome
2. derive measured capability shape
3. identify declared vs measured gaps
4. classify major failure patterns
5. attach evidence anchors
6. generate prioritized suggested changes
7. generate retest recommendations
8. write executive summary

This order matters because the summary should be the result of the diagnosis, not the source of it.

## V1 Generation Strategy

V1 can be produced with rule-based logic.

Suggested sources:

- `run events`
- `judge findings`
- `admission result`
- `declared build`
- `measured build`

That is enough to create useful structured output before introducing more advanced analysis.

## Version Comparison Readiness

This schema is designed so later comparison can ask:

- which failure classes disappeared
- which new failure classes appeared
- which dimensions improved
- whether suggested changes actually reduced targeted failure patterns

That is why stable ids and enums matter.

## API Implication

Eventually the run summary API should likely include:

```ts
interface RunSummaryResponse {
  readonly runId: string;
  readonly scenario: unknown;
  readonly judge: unknown;
  readonly admission: unknown;
  readonly measuredProfile: unknown;
  readonly improvementReport?: ImprovementReport;
}
```

V1 can keep this optional until report generation is implemented.

## UI Implication

The UI should be able to render the report in this order:

1. executive summary
2. build shape and capability interpretation
3. key failure patterns
4. evidence links into replay
5. suggested changes
6. recommended next re-test

That keeps the page aligned with the user's actual decision flow.

## Working Rule

The schema should always support this question:

`what is the single best next change to try, and what evidence justifies that recommendation?`

If the contract cannot answer that clearly, it is not good enough yet.

## Suggested Next Follow-Up

The next step should be an implementation-facing spec for:

- deriving `failurePatterns` from current `RunEvent`
- deriving `suggestedChanges` from failure patterns and measured capability gaps
- exposing `improvementReport` in the run summary API
