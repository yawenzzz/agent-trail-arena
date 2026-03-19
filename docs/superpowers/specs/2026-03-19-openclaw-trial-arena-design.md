# OpenClaw Trial Arena Design

## Summary

OpenClaw Trial Arena is an interactive sandbox for validating whether a new agent build is fit for production use. The product combines a "character build" model with a benchmark-style task arena:

- Users define an agent's intended strengths on a fixed set of attributes.
- The system maps that declared build to a trial profile.
- The trial profile changes task selection, score weighting, and admission thresholds.
- The agent runs in a controlled sandbox while users observe execution in real time.
- The system produces both pass/fail style admission output and a measured attribute profile.
- The measured profile is compared to the declared profile so the system can detect inflated or inaccurate capability claims.

The first spec covers the `Trial Arena` sub-project only. It does not attempt to fully define the broader OpenClaw platform, marketplace, or lifecycle workflows.

## Problem

OpenClaw needs a reliable way to evaluate new agents before they are used in production. A simple leaderboard is not enough for this use case:

- Different agents may be intentionally specialized.
- Users need to understand what an agent is actually good at, not just its average score.
- Developers need a way to watch failures happen, inspect evidence, and iterate.
- Production admission requires hard safety and correctness gates, not only aggregate ranking.

The system should feel like a trial ground for agent builds. A user should be able to declare what an agent is supposed to be good at, send it into a set of trials, and see whether the observed behavior matches the intended build.

## Goals

- Create an interactive evaluation arena for a single agent build.
- Support a fixed attribute model that mixes "role-like" agent strengths with production-facing constraints.
- Use agent attributes to influence trial selection, score weighting, and admission thresholds.
- Combine standard benchmark tasks with realistic OpenClaw workflow tasks.
- Provide real-time execution visibility without exposing raw chain-of-thought.
- Produce explainable scores, evidence, and admission decisions.
- Detect and surface mismatch between declared and measured agent capabilities.

## Non-Goals

- Building a full multi-agent marketplace or recommendation engine.
- Solving automated training, fine-tuning, or self-improvement loops.
- Supporting arbitrary user-defined attributes in the first version.
- Defining every future OpenClaw product surface outside Trial Arena.
- Replacing human judgment for high-risk production launches.

## Primary Users

### OpenClaw Developers

- Define an agent build and run it through trials.
- Observe live execution, failures, and scoring evidence.
- Use results to debug weak spots before resubmitting the agent.

### OpenClaw Users

- Understand what a candidate agent is actually good at.
- Inspect whether an agent is safe and reliable enough for intended usage.
- Compare declared behavior against observed behavior.

## Product Definition

Trial Arena is an interactive agent trial table, not just a static benchmark page. A user selects an agent version, assigns an intended build on a fixed attribute system, and enters a curated set of trial scenarios. During each scenario, the agent runs in a controlled sandbox and the UI streams execution events, tool usage, warnings, and scoring updates. After the run, the system shows per-scenario outcomes and updates the agent's measured profile.

The core loop is:

`Define build -> Enter trial -> Watch execution -> Review evidence -> Compare declared vs measured profile -> Decide admission status`

The system must optimize for explainability and trust. It should be possible to answer:

- What build did the user declare?
- What scenario did the system choose and why?
- What did the agent do?
- Why did it pass or fail?
- Which observed behaviors support the measured profile?
- Is this build acceptable for production, and under what scope?

## Recommended Product Approach

The recommended approach is `Build-Driven Arena`.

Why this approach:

- It best matches the user's desired "game-like build plus trial verification" mental model.
- It makes the declared build operational instead of cosmetic.
- It allows production admission to be tailored without giving up hard safety floors.

Alternatives considered:

- `Benchmark-First`: simpler and more comparable, but too weak on build-driven behavior.
- `Sandbox Runtime-First`: stronger as infrastructure, but weaker as a first product experience.

The implementation can still borrow from the runtime-first approach internally by prioritizing strong sandbox observability under the product surface.

## Attribute Model

The first version uses a fixed attribute system with two layers.

### Role-Like Capability Axes

- Planning ability
- Execution ability
- Tool proficiency
- Recovery ability
- Efficiency tendency

### Production Constraint Axes

- Correctness
- Robustness
- Safety discipline
- Cost awareness
- Observability

Users do not set raw guaranteed scores. They define the intended tendency and importance of each axis for the build. Example:

- High planning
- High robustness
- Medium efficiency
- High safety discipline
- Low cost sensitivity

This produces a `trial profile`, which is the machine-readable form used by the evaluation system.

The trial profile must be serializable and versioned so that the same declared build can be rerun later under the same evaluation settings.

## Trial Profile Mapping

The `trial profile` must affect three parts of evaluation.

### 1. Scenario Selection

The system selects scenarios that reflect the declared build.

Examples:

- High planning: more multi-stage decomposition tasks and long-chain execution tasks.
- High recovery: more interruption, failure-injection, and retry-oriented tasks.
- High safety discipline: more permission-boundary, destructive-operation, and sensitive-output tasks.
- High efficiency: more time-bound and step-budget-sensitive tasks.

### 2. Score Weighting

All scenarios can expose multiple scoring dimensions. The build changes their relative importance.

Examples:

- Efficiency-heavy builds weigh latency and step count more strongly.
- Robustness-heavy builds weigh fallback behavior and failure recovery more strongly.
- Safety-heavy builds weigh confirmation behavior and risk avoidance more strongly.

### 3. Admission Thresholds

The declared build affects what the system emphasizes when deciding whether the build is acceptable.

Examples:

- A safety-oriented build may tolerate average speed, but not safety discipline failures.
- An efficiency-oriented build may face stricter latency expectations, but still must clear minimum correctness and safety gates.

Hard floors still apply. Attribute emphasis can change where scrutiny is strongest, not eliminate core guardrails.

### Reproducibility Rule

Trial profile generation must be reproducible. Given the same:

- agent version
- declared build
- scenario registry version
- selection seed
- judge configuration version

the system should be able to reconstruct the same trial setup for replay, comparison, and retest.

## Scenario Model

The first version uses a mixed scenario library:

- `Standard trials`: stable benchmark-like scenarios used for cross-agent comparison.
- `Workflow trials`: realistic OpenClaw-flavored scenarios derived from actual usage patterns.

Every scenario record must declare:

- Scenario id and title
- Scenario type (`standard` or `workflow`)
- Goal statement
- Allowed tools and environment constraints
- Expected artifacts or success conditions
- Targeted attributes
- Red-line rules
- Default score dimensions
- Supported judges

This metadata is required so scenarios can be selected, executed, scored, and explained consistently.

## Interaction Model

The first version is interactive-first. The product is designed around watching one trial happen and inspecting the result immediately after.

### Arena Layout

The UI should use a three-panel layout.

#### Left Panel: Build and Scenario Panel

- Agent version and metadata
- Declared build attributes
- Active trial profile
- Scenario queue or scenario selector
- Attribute tags for each scenario

#### Center Panel: Live Execution Stage

- Current scenario objective
- Execution stage or phase
- Structured reasoning summary
- Tool calls and key inputs/outputs
- Timing and resource indicators
- Safety/risk warnings

The center panel must not expose raw chain-of-thought. It should expose structured trace data that is sufficient for debugging and trust.

#### Right Panel: Judge and Result Panel

- Rule-based judgments
- LLM-based judgments
- Deductions and rationales
- Evidence links
- Current scenario score
- Contribution to measured profile

### Primary Flow

1. User selects an agent build or creates one.
2. User enters a scenario or a trial sequence.
3. The sandbox starts a controlled execution.
4. The UI streams execution events and judge updates.
5. The run ends with a scenario result card.
6. The system updates measured attributes and admission posture.
7. The user can replay the run to inspect failures or edge behavior.

## Scoring Model

The scoring system uses three layers.

### Layer 1: Red-Line Rules

These are hard gates that can fail a scenario immediately or block production admission regardless of overall score.

Examples:

- Dangerous commands without required confirmation
- Unauthorized access attempts
- Clearly incorrect final outputs on core tasks
- Failure to stop when required
- Sensitive data exposure

These rules are non-negotiable. No build specialization can waive them.

### Layer 2: Dimension Scores

Each scenario produces dimension-level scores such as:

- Task completion
- Output correctness
- Latency
- Cost
- Tool use quality
- Recovery quality
- Process stability

These scores are normalized and then weighted according to the trial profile.

### Layer 3: Build Deviation

The system compares the declared build against measured behavior. This is a first-class output, not a side note.

Examples:

- A build declares high planning but performs weakly on decomposition-heavy scenarios.
- A build declares high robustness but fails on recovery and interruption scenarios.
- A build declares high safety discipline but triggers risky actions or boundary violations.

This deviation result should clearly signal when a build is overstated or misleading.

### Measured Profile Derivation

The measured profile should be computed from scenario outcomes rather than entered manually.

- Each scenario contributes evidence to one or more targeted attributes.
- Red-line failures can cap or heavily penalize affected production constraint axes.
- Weighted dimension scores contribute positively or negatively to the targeted axes.
- The system should store both per-scenario contribution details and the final aggregate profile.

The first implementation plan does not need to invent a sophisticated statistical model. It only needs a deterministic and explainable aggregation method that can be traced from scenario result back to final measured attribute values.

## Judge Model

The first version uses a hybrid judge stack.

### Rule Judge

Use deterministic checks wherever possible:

- Output shape or schema
- Allowed/disallowed tool usage
- Permission compliance
- Time or step budgets
- Presence of required artifacts

### LLM Judge

Use LLM-based grading where semantic evaluation is required:

- Quality of decision making
- Quality of intermediate task handling
- Appropriateness of fallback behavior
- Partial success in realistic workflow tasks

### Judge Requirements

- Rule judge runs first.
- LLM judge is applied only where deterministic grading is insufficient.
- Every LLM judgment must store supporting evidence and rationale.
- The UI must expose a review path for ambiguous or surprising judgments.
- Admission decisions should remain explainable even when LLM judgment is involved.

## Admission Output

Trial Arena should not reduce everything to a single binary flag. The first version should support at least four admission outcomes:

- `Production Ready`
- `Limited Scope Trial`
- `Needs Tuning and Retest`
- `Not Allowed for Production`

Each result must include a short explanation, for example:

- Passed safety and correctness floors, but measured planning is lower than declared.
- Safe enough for low-risk retrieval tasks, not suitable for multi-step operational workflows.
- Strong performance overall, but unstable under interruption and retry conditions.

## System Architecture

The first version should be split into five modules.

### 1. Build Profile Service

Responsibilities:

- Store agent version metadata and declared build
- Convert build input into a trial profile
- Expose trial profile configuration to scenario selection and scoring

### 2. Scenario Registry

Responsibilities:

- Store standard and workflow scenario definitions
- Provide searchable metadata for scenario selection
- Define allowed tools, success criteria, targeted attributes, and red lines

### 3. Sandbox Runner

Responsibilities:

- Launch the agent in a controlled environment
- Enforce tool and environment constraints
- Capture event streams, resource usage, errors, and risk hits
- Support replay and trace review

This is the trust foundation of the system.

### 4. Judge Engine

Responsibilities:

- Execute rule-based checks
- Invoke LLM-based judges when needed
- Produce dimension scores, red-line outcomes, and evidence packages
- Update the measured attribute profile

### 5. Arena UI

Responsibilities:

- Present build data, scenario data, and live execution state
- Stream trace events to users
- Display score explanations, measured profile, and admission output
- Support replay and post-run inspection

## Data Flow

The end-to-end flow is:

`Declared build -> Trial profile -> Scenario selection -> Sandbox execution -> Event stream -> Judge engine -> Scenario result -> Measured profile -> Admission result`

The most important product-level invariant is that every visible conclusion should be traceable back to scenario metadata, sandbox events, and judge outputs.

## Failure Handling

The first version must distinguish at least three failure classes.

### Execution Failure

Examples:

- Timeout
- Crash
- Tool failure
- Agent deadlock or no-progress state

### Evaluation Failure

Examples:

- Judge cannot produce a stable verdict
- Missing artifacts prevent scoring
- Evidence is insufficient for a meaningful conclusion

### Safety Failure

Examples:

- Dangerous action attempt
- Permission violation
- Sensitive output generation

These failure classes must be surfaced separately in the UI and reports because they imply different follow-up actions.

## Verification Strategy

The system should be validated at three levels.

### Scenario Tests

Verify each scenario definition is internally valid:

- Required metadata is present
- Success conditions are machine-checkable where expected
- Red-line rules are well-defined

### Judge Consistency Tests

Verify the judge stack behaves consistently on fixed samples:

- Deterministic rules produce stable outputs
- LLM judgments stay within acceptable variance on gold examples
- Judge disagreement is visible, not silently averaged away

### End-to-End Trial Tests

Verify the full trial path:

- Build configuration is translated correctly
- Scenario selection reflects the declared build
- Sandbox events reach the UI
- Results can be replayed and explained
- Admission output matches score and red-line outcomes

## Deferred Work

These items are intentionally out of scope for the first spec and should not be treated as committed first-version requirements:

- User-defined custom attributes
- Multi-agent tournaments or ladder ranking
- Automatic retraining or self-healing loops
- Fully automated production promotion without human review
- Public benchmark publishing

## Planning Constraints

The next implementation plan should keep the first milestone narrow. The minimum useful version should focus on:

- One fixed attribute system
- A small scenario registry with both standard and workflow trials
- A real sandbox event model
- Hybrid judging on a limited set of dimensions
- A single interactive arena view with replay for completed runs

The implementation plan should avoid expanding into marketplace, recommendation, or broad governance systems before the core trial loop works end to end.
