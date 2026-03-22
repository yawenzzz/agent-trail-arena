# Run Analysis V1 Design

## Summary

Add a first structured analysis layer to Trial Arena so every completed run produces a stable, evidence-backed diagnosis artifact rather than only a score, findings list, and admission label.

This design prioritizes the first two product directions captured in the March 20 notes:

1. `Failure Taxonomy + Judge Output V1`
2. `Improvement Report V1`

The immediate goal is to make Trial Arena useful for agent improvement, not only evaluation. The system should classify important failure patterns, attach evidence anchors, generate pragmatic suggested changes, and persist the result as part of the completed run.

## Goals

- Introduce a stable `RunAnalysis` artifact for every completed run.
- Add a V1 failure taxonomy with the eight top-level classes from the product notes.
- Generate evidence-backed improvement reports using deterministic rules only.
- Persist the analysis artifact alongside the existing stored run data.
- Expose analysis through a dedicated API route.
- Keep the design ready for later version-to-version comparison without implementing comparison flow yet.

## Non-Goals

- Building a new web results page in this pass.
- Building a TUI in this pass.
- Adding LLM-based diagnosis or suggestion generation.
- Supporting historical multi-run aggregation.
- Implementing a full subtype ontology beyond pragmatic rule-named strings.
- Implementing version comparison execution or UI.

## Product Boundary

Run Analysis V1 is a backend-first feature.

The output surface for this pass is:

- persisted analysis on each stored run
- a dedicated run analysis API
- stable domain types that later consumers can use

This pass does not require a new frontend. Existing web pages may remain unchanged until a later slice consumes the new analysis route.

## Recommended Architecture

The recommended architecture is:

`runner -> judge -> analysis -> finalize -> API`

The current run lifecycle already produces:

- `scenario`
- `events`
- `replay`
- `judge`
- `admission`
- `measuredProfile`

Run Analysis V1 should treat those outputs as inputs and derive a separate structured artifact:

- `analysis`

The artifact should be generated once when the run completes and then persisted as part of `StoredRun`. This keeps diagnoses stable over time and avoids recomputing analysis differently when code changes later.

## Data Model

### New Domain Types

Add focused types under `packages/domain` for analysis contracts.

Recommended types:

- `EvidenceAnchor`
- `FailureClass`
- `FailureSeverity`
- `ConfidenceLevel`
- `EvidenceMode`
- `ChangeType`
- `RetestType`
- `FailurePattern`
- `SuggestedChange`
- `RetestPlan`
- `CapabilityInsight`
- `ImprovementReport`
- `RunAnalysis`

### RunAnalysis Shape

`RunAnalysis` should act as the root artifact for one completed run.

Recommended fields:

- `reportVersion`
- `runId`
- `scenarioId`
- `generatedAt`
- `summary`
- `capabilityInsights`
- `failurePatterns`
- `suggestedChanges`
- `evidenceAnchors`
- `confidence`
- `comparisonKeys`

### Comparison Readiness

Although version comparison is out of scope, the schema should preserve the fields needed later for diffing and grouping.

Recommended comparison-oriented fields:

- taxonomy classes represented in the run
- affected capability dimensions
- suggested change types

This should be expressed through a small `comparisonKeys` object rather than by overloading user-facing summary fields.

## Module Decomposition

### packages/domain

Responsibility:

- define the analysis data contracts
- export shared enums and interfaces
- keep analysis separate from `JudgeResult`

Important boundary:

`JudgeResult` should remain focused on deterministic rule-judge output. Analysis is a separate artifact, not an expanded judge blob.

### packages/judge

Responsibility:

- keep existing `judgeScenario(...)`
- add a new `analyzeRun(...)` entry point
- derive structured analysis from existing run outputs

Recommended internal split:

- `evidence-extractor`
- `failure-classifier`
- `suggestion-generator`
- `report-generator`

This keeps future replacement of one stage possible without rewriting the full pipeline.

### packages/orchestrator

Responsibility:

- call `analyzeRun(...)` after `judgeScenario(...)`
- persist `analysis` inside `StoredRun`

Recommended lifecycle:

1. runner returns `events + replay`
2. judge returns `judge + admission + measuredProfile`
3. analysis returns `RunAnalysis`
4. finalize persists all four result layers

### apps/api

Responsibility:

- expose a dedicated analysis endpoint
- keep run summary and analysis artifact as separate route concerns

Recommended route:

- `GET /runs/:runId/analysis`

This is preferred over embedding the full analysis artifact directly into the existing run-summary route because the shapes serve different purposes and will likely evolve at different speeds.

## Failure Taxonomy V1

The V1 taxonomy should implement the top-level classes already described in the notes:

- `goal_understanding`
- `decomposition`
- `tool_use`
- `recovery`
- `safety`
- `observability`
- `robustness`
- `efficiency`

### Taxonomy Rules

V1 should use deterministic classification rules only.

The system should not infer hidden model intent. It should classify only from observable evidence in:

- run events
- replay events
- judge findings
- terminal outcome

### Subtypes

Subtype strings should be pragmatic and rule-originated, for example:

- `dangerous_shell_command`
- `no_retry_after_tool_failure`
- `missing_blocker_reporting`

This is enough for V1 reporting and future grouping without pretending the system can perfectly explain every failure mode.

## Evidence Anchor Strategy

Every visible conclusion in the analysis must link back to concrete evidence.

### Supported Sources

V1 evidence anchors should be extracted from:

- `events`
- `judge.findings`
- `replay.events`

### Required Fields

Recommended fields:

- `anchorId`
- `runId`
- `eventType`
- `eventIndex`
- `replayTimestampMs` optional
- `summary`

### Rule

Each `FailurePattern` and each `SuggestedChange` must reference at least one anchor. Conclusions without evidence references are out of scope for V1.

## Improvement Report Strategy

The improvement report should be deterministic and failure-driven.

It should answer:

1. what happened
2. what it says about the agent
3. why it likely happened
4. what to try next

### Required Sections

- executive summary
- capability insights
- failure diagnosis
- evidence anchors
- suggested changes
- retest recommendations

### Suggestion Generation

Suggested changes should come from failure patterns rather than generic advice.

Example mappings:

- `recovery` -> add retry and fallback policy
- `observability` -> require blocker and uncertainty reporting
- `tool_use` -> improve tool selection and tool-output parsing contract
- `safety` -> add stronger confirmation or escalation steps before risky actions

Each suggested change should include:

- priority
- change type
- reason
- expected impact dimensions
- targeted failure patterns
- recommended retest

## End-to-End Flow

The completed V1 run flow should be:

1. execute the selected scenario
2. capture `events` and `replay`
3. derive `judge`, `admission`, and `measuredProfile`
4. derive `analysis`
5. persist all data into `StoredRun`
6. serve `analysis` through the dedicated API route

## Storage Changes

`StoredRun` should be expanded with:

- `analysis: RunAnalysis`

Existing fields should remain in place to avoid breaking current behavior:

- `runId`
- `profile`
- `scenario`
- `events`
- `replay`
- `judge`
- `admission`
- `measuredProfile`

## Testing Strategy

V1 should emphasize contract tests and golden-sample tests.

### packages/domain

- schema and type-shape tests for new analysis contracts

### packages/judge

- unit tests for evidence extraction
- unit tests for failure classification
- unit tests for suggestion generation
- unit tests for report generation

### packages/orchestrator

- run finalization tests proving analysis is persisted with the stored run

### apps/api

- route tests for `GET /runs/:runId/analysis`
- coverage for unknown runs and response-shape stability

### Golden Samples

Add a small set of fixed run fixtures and assert the key analysis output for each one. This should protect against silent drift in taxonomy and suggestion behavior.

## Risks

### Overloading JudgeResult

If analysis fields are added directly to `JudgeResult`, the boundary between rule judging and diagnosis will become muddy and make future evolution harder.

Mitigation:

- keep analysis as a separate artifact

### Low-Signal Suggestions

If suggestions are not tied to failure patterns, the product will regress into generic benchmark theater.

Mitigation:

- require every suggestion to target diagnosed failures and evidence anchors

### Premature Frontend Work

If UI work is pulled into this slice, the real data-contract work may stay vague.

Mitigation:

- treat this pass as backend-first

## Future Extensions

The next planned layer after this design is:

1. consume `RunAnalysis` in a minimal result surface
2. add version-to-version comparison using persisted comparison keys
3. consider hybrid or LLM-assisted diagnosis only after the deterministic baseline is trusted

## Success Criteria

This design is successful when:

- a completed run produces a persisted `RunAnalysis`
- the artifact contains evidence-backed failure patterns and suggestions
- the API can return that artifact directly
- the schema is stable enough to support future result surfaces and version comparison
