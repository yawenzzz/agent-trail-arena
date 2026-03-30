# Run Analysis And Grade Assessment V1 Design

## Summary

Add a first qualification-oriented evaluation layer to Trial Arena so every completed run can support an evidence-backed grade recommendation and authorization decision.

This design updates the previous run-analysis direction. `RunAnalysis` remains important, but it is no longer the top-level product artifact. It becomes the middle layer between raw run evidence and the final `GradeAssessment`.

The new output hierarchy is:

`run evidence -> run analysis -> grade assessment`

The immediate goal is not just to help builders improve agents. It is to help them decide what level of responsibility an agent can safely carry today, what it must not yet be authorized to do, and what gaps block promotion.

## Goals

- Keep `RunAnalysis` as a stable evidence-backed diagnosis artifact.
- Add a new top-level `GradeAssessment` artifact.
- Support a V1 common grade ladder:
  - `Intern`
  - `Junior`
  - `Mid`
  - `Senior`
  - `Lead`
- Make grade recommendation depend on deterministic responsibility and boundary checks, not average score alone.
- Persist both `RunAnalysis` and `GradeAssessment` with each completed run.
- Expose grade-focused outputs through dedicated API routes.
- Keep the schema ready for later version-to-version grade comparison.

## Non-Goals

- Building a new frontend grade dashboard in this pass.
- Building a TUI in this pass.
- Adding LLM-based diagnosis or grade assignment.
- Supporting role-specific ladders such as coder-only or researcher-only tracks.
- Implementing historical multi-run grade trend views.
- Implementing automated task dispatch integration with external builder frameworks in this pass.

## Product Boundary

V1 remains backend-first.

The output surface for this pass is:

- persisted `RunAnalysis`
- persisted `GradeAssessment`
- dedicated API access to both artifacts
- stable domain contracts for later consumers

Existing web pages can remain unchanged until a later slice consumes the new artifacts.

## Recommended Architecture

The recommended architecture is:

`runner -> judge -> run analysis -> grade evaluation -> finalize -> API`

The run lifecycle should now produce four result layers:

- `judge`
- `admission`
- `runAnalysis`
- `gradeAssessment`

The distinction matters:

- `judge` identifies direct rule findings and red lines
- `runAnalysis` explains capability and failure patterns
- `gradeAssessment` translates those signals into qualification and authorization language

## Product Semantics

The key product rule is:

`grade is an authorization level, not a vanity label`

That means Trial Arena should not answer only:

- how good was the agent

It should answer:

- what level of responsibility is justified
- what kind of work may be delegated
- what kind of work must still be restricted
- what evidence supports those decisions

## Data Model

### RunAnalysis

`RunAnalysis` remains the diagnosis layer.

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

`RunAnalysis` should answer:

- what happened
- what weaknesses or strengths were observed
- what should be improved next

### GradeAssessment

Add a new top-level artifact:

- `GradeAssessment`

Recommended fields:

- `assessmentVersion`
- `runId`
- `scenarioId`
- `recommendedGrade`
- `gradeConfidence`
- `authorizedScope`
- `restrictedScope`
- `promotionGaps`
- `blockingIssues`
- `supportingEvidence`
- `recommendedNextActions`
- `comparisonKeys`

`GradeAssessment` should answer:

- what grade the agent currently qualifies for
- what it may currently be trusted to do
- what it must not yet be trusted to do
- what blocks promotion to the next level

### Grade Ladder

V1 should support a common ladder:

- `Intern`
- `Junior`
- `Mid`
- `Senior`
- `Lead`

This ladder should be interpreted as responsibility and authorization levels, not raw capability tiers.

## Module Decomposition

### packages/domain

Responsibility:

- define `RunAnalysis` contracts
- define `GradeAssessment` contracts
- define common grade enums and authorization-related types

Recommended new types:

- `AgentGrade`
- `AuthorizationScope`
- `PromotionGap`
- `BlockingIssue`
- `GradeAssessment`

Important boundary:

- `JudgeResult` remains focused on rule findings
- `RunAnalysis` remains focused on diagnosis
- `GradeAssessment` becomes the user-facing qualification artifact

### packages/judge

Responsibility:

- keep existing `judgeScenario(...)`
- keep or expand `analyzeRun(...)`
- add a new `evaluateGrade(...)` entry point

Recommended internal split:

- `evidence-extractor`
- `failure-classifier`
- `suggestion-generator`
- `report-generator`
- `grade-evaluator`

This allows the system to treat diagnosis and grade assignment as separate layers while still sharing evidence extraction and rule signals.

### packages/orchestrator

Responsibility:

- call `analyzeRun(...)` after `judgeScenario(...)`
- call `evaluateGrade(...)` after analysis generation
- persist both artifacts in `StoredRun`

Recommended lifecycle:

1. runner returns `events + replay`
2. judge returns `judge + admission + measuredProfile`
3. analysis returns `RunAnalysis`
4. grade evaluation returns `GradeAssessment`
5. finalize persists the full result set

### apps/api

Responsibility:

- expose dedicated read routes for analysis and grade assessment
- keep run summary, analysis, and grade assessment as separate route concerns

Recommended routes:

- `GET /runs/:runId/analysis`
- `GET /runs/:runId/grade`

This separation helps later consumers read only the artifact they need.

## Responsibility-First Evaluation

The system should not assign grade using average score alone.

V1 should use:

- hard gates
- responsibility checks
- consistency checks

### Hard Gates

These are blockers for a target grade.

Examples:

- unsafe high-risk action
- boundary violation
- hidden failure or false completion
- failure to escalate uncertainty when required
- failure to report blockers appropriately

### Responsibility Checks

These ask whether the agent can actually carry the level of work implied by the grade.

Examples:

- can it finish standard tasks reliably
- can it recover from tool failures
- can it handle ambiguity appropriately
- can it control risk before acting
- can it provide auditable final reporting

### Consistency Checks

The system should guard against grading on a single lucky run.

V1 may begin with per-run grade recommendation, but the schema should allow later multi-run stability checks and grade trend comparisons.

## Capability Model

The existing capability dimensions remain useful as intermediate evidence:

- `planning`
- `execution`
- `toolProficiency`
- `recovery`
- `robustness`
- `safetyDiscipline`
- `efficiency`
- `correctness`
- `costAwareness`
- `observability`

These dimensions should inform grade evaluation, not replace it.

Examples:

- weak `observability` can restrict independent ownership
- weak `recovery` can block promotion beyond lower grades
- weak `safetyDiscipline` can block higher autonomy
- strong `planning` and `toolProficiency` can support broader authorization only if behavior is also safe and visible

## Failure Taxonomy V1

The V1 taxonomy still uses the same top-level classes:

- `goal_understanding`
- `decomposition`
- `tool_use`
- `recovery`
- `safety`
- `observability`
- `robustness`
- `efficiency`

Its role is now dual-purpose:

- diagnosis
- grade blocking or authorization narrowing

Examples:

- `safety` failures can cap the maximum recommended grade
- `observability` failures can restrict autonomous ownership
- `recovery` failures can restrict multi-step task delegation
- `decomposition` failures can restrict higher-ambiguity work

## Evidence Anchor Strategy

Every analysis conclusion and every grade conclusion must link back to concrete evidence.

Supported sources:

- `events`
- `judge.findings`
- `replay.events`

Recommended fields:

- `anchorId`
- `runId`
- `eventType`
- `eventIndex`
- `replayTimestampMs` optional
- `summary`

Rule:

- each `FailurePattern` must reference evidence
- each `SuggestedChange` must reference evidence
- each `BlockingIssue` must reference evidence
- each authorization restriction should reference evidence

## Improvement Report Strategy

The improvement report remains valuable, but it is no longer the final product layer.

It should continue to answer:

1. what happened
2. what it says about the agent
3. why it likely happened
4. what to try next

That output now feeds grade evaluation by explaining why promotion is blocked or why scope must be restricted.

## Grade Assessment Strategy

`GradeAssessment` should be deterministic and responsibility-first.

It should not say only:

- the agent looks strong

It should say:

- the agent is currently best classified as `Junior`
- it may own standard low-risk tasks
- it should not yet own ambiguous multi-step work
- promotion to `Mid` is blocked by weak recovery and incomplete blocker reporting

### Required Sections

Recommended grade assessment sections:

- grade recommendation
- confidence
- authorized scope
- restricted scope
- blocking issues
- promotion gaps
- recommended next actions
- supporting evidence

## End-to-End Flow

The V1 run flow should be:

1. execute the selected scenario
2. capture `events` and `replay`
3. derive `judge`, `admission`, and `measuredProfile`
4. derive `runAnalysis`
5. derive `gradeAssessment`
6. persist the completed result set
7. serve artifacts through dedicated routes

## Storage Changes

`StoredRun` should expand with:

- `runAnalysis: RunAnalysis`
- `gradeAssessment: GradeAssessment`

Existing fields should remain in place:

- `runId`
- `profile`
- `scenario`
- `events`
- `replay`
- `judge`
- `admission`
- `measuredProfile`

## Comparison Readiness

Although full version comparison is still out of scope, both artifacts should carry comparison keys that make later grade diffing possible.

Recommended comparison-oriented fields:

- represented failure classes
- affected capability dimensions
- suggested change types
- recommended grade
- blocking issue categories
- authorization categories

## Testing Strategy

V1 should emphasize contract tests and golden-sample tests.

### packages/domain

- schema and type-shape tests for `RunAnalysis` and `GradeAssessment`

### packages/judge

- unit tests for evidence extraction
- unit tests for failure classification
- unit tests for suggestion generation
- unit tests for grade evaluation
- unit tests for blocking issue and promotion gap generation

### packages/orchestrator

- finalization tests proving both artifacts are persisted with the stored run

### apps/api

- route tests for `GET /runs/:runId/analysis`
- route tests for `GET /runs/:runId/grade`
- coverage for unknown runs and response-shape stability

### Golden Samples

Add a small set of fixed run fixtures and assert key outputs such as:

- recommended grade
- restricted scope
- blocking issues
- promotion gaps

This should guard against silent drift in qualification semantics.

## Risks

### Grade As Score Skin

If grade is implemented as a renamed score, the product will drift back toward benchmark theater.

Mitigation:

- make authorization scope and blocking issues first-class outputs

### Weak Employment Semantics

If grades do not map to real delegation decisions, the builder cannot act on them.

Mitigation:

- define grade outputs in terms of allowed and restricted work

### Premature Role Specialization

If the project introduces multiple career tracks too early, the common ladder will remain underspecified.

Mitigation:

- ship a single common ladder first

## Future Extensions

After this design, the next layers should be:

1. define the common grade ladder rigorously
2. define grade packs aligned to responsibility levels
3. consume `GradeAssessment` in result surfaces
4. add version-to-version grade comparison
5. integrate grade-aware task dispatch workflows with builder systems

## Success Criteria

This design is successful when:

- a completed run produces a persisted `RunAnalysis`
- a completed run also produces a persisted `GradeAssessment`
- the grade output is expressed in authorization language, not score language
- the API can return both artifacts directly
- the schema is stable enough to support future result surfaces and grade comparison
