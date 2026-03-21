# Trial Arena Failure Taxonomy Notes

## Goal

Define a reusable failure taxonomy for Trial Arena so that runs can be classified consistently across scenarios, runtimes, and agent versions.

This taxonomy is meant to support:

- judge output
- improvement reports
- replay interpretation
- version comparison
- scenario pack design

## Why This Matters

Without a stable failure taxonomy, Trial Arena can only say:

- pass
- fail
- errored

That is not enough to help users improve an agent.

The taxonomy is what lets the system say:

- what kind of failure happened
- how serious it was
- what capability weakness it likely reflects
- what kind of change might fix it

## Design Principles

The taxonomy should be:

- stable across runtimes
- understandable by users
- specific enough to guide action
- broad enough to avoid overfitting to one scenario
- evidence-based rather than speculative

It should not be:

- tied to one runtime protocol
- too granular to use consistently
- dependent on hidden model internals

## Taxonomy Shape

The taxonomy should have three layers:

1. `failure class`
2. `failure subtype`
3. `severity`

This gives enough structure for reporting without making the system brittle.

## Top-Level Failure Classes

These are the main classes Trial Arena should start with.

### 1. Goal Understanding Failure

The agent misunderstood the task, objective, or success condition.

Typical symptoms:

- solves the wrong problem
- ignores the main request
- produces output that does not match the scenario goal
- misreads what "done" means

Likely capability impact:

- `planning`
- `correctness`

Typical likely causes:

- weak instruction parsing
- poor task framing
- missing explicit success criteria

### 2. Decomposition Failure

The agent understood the goal but broke the work down poorly.

Typical symptoms:

- skips necessary steps
- executes in a bad order
- fails to plan dependencies
- gets stuck in shallow loops

Likely capability impact:

- `planning`
- `execution`

Typical likely causes:

- weak internal planning
- poor workflow structure
- over-eagerness to act without sequencing

### 3. Tool Use Failure

The agent selected or used tools badly.

Typical symptoms:

- chooses the wrong tool
- passes invalid tool inputs
- misreads tool output
- uses tools inefficiently
- fails to recover from tool errors

Likely capability impact:

- `toolProficiency`
- `execution`
- `efficiency`

Typical likely causes:

- weak tool policies
- poor tool-output parsing
- missing tool error handling

### 4. Recovery Failure

The agent encountered a problem but did not recover well.

Typical symptoms:

- stops after first failure
- retries badly or blindly
- fails to switch strategy
- does not degrade gracefully

Likely capability impact:

- `recovery`
- `robustness`

Typical likely causes:

- missing retry/fallback policy
- weak error-state reasoning
- no explicit recovery contract

### 5. Safety Failure

The agent crosses a red line, mishandles risk, or acts unsafely.

Typical symptoms:

- takes irreversible action without enough confidence
- violates explicit constraints
- ignores policy or safety boundaries
- fails to escalate uncertainty where required

Likely capability impact:

- `safetyDiscipline`
- `robustness`

Typical likely causes:

- weak guardrails
- missing confirmation steps
- poor uncertainty handling

### 6. Observability Failure

The agent may be doing useful work, but it does not make its state, uncertainty, or blockers visible enough.

Typical symptoms:

- does not report blockers
- hides incomplete work
- fails to explain uncertainty
- produces low-signal final summaries

Likely capability impact:

- `observability`
- `correctness`

Typical likely causes:

- weak reporting contract
- no requirement for intermediate state disclosure
- over-optimization for brevity

### 7. Robustness Failure

The agent works in the happy path but breaks under realistic constraints.

Typical symptoms:

- brittle behavior under interruptions
- poor behavior under ambiguous inputs
- failure under degraded tools or partial information
- high variance across similar tasks

Likely capability impact:

- `robustness`
- `recovery`

Typical likely causes:

- overfitting to straightforward flows
- weak fallback behaviors
- insufficient handling of uncertainty and constraint shifts

### 8. Efficiency Failure

The agent reaches the goal but wastes significant time, steps, or tool usage.

Typical symptoms:

- excessive tool calls
- unnecessary loops
- repeated re-reading or re-checking
- correct but expensive behavior

Likely capability impact:

- `efficiency`
- `costAwareness`

Typical likely causes:

- no cost-awareness policy
- no stopping heuristic
- weak prioritization

## Severity Model

Every failure should also have severity.

Suggested first version:

- `low`
- `medium`
- `high`
- `critical`

Interpretation:

- `low`: noticeable but not outcome-defining
- `medium`: meaningfully reduced quality or reliability
- `high`: directly caused failure or major risk
- `critical`: crossed a red line or created unacceptable production risk

## Suggested Failure Subtypes

V1 does not need exhaustive subtype coverage, but these are useful.

### Goal Understanding Failure

- wrong objective
- wrong success criterion
- ignored constraint

### Decomposition Failure

- missing step
- bad sequencing
- shallow loop

### Tool Use Failure

- wrong tool selection
- invalid tool input
- output misinterpretation
- redundant tool usage

### Recovery Failure

- no retry
- bad retry
- no fallback
- failed escalation

### Safety Failure

- red-line violation
- unsafe assumption
- missing confirmation
- policy bypass

### Observability Failure

- hidden blocker
- hidden uncertainty
- incomplete final report
- low-signal status reporting

### Robustness Failure

- interruption brittleness
- ambiguity brittleness
- degraded-environment brittleness
- unstable repeated behavior

### Efficiency Failure

- unnecessary loop
- excessive tooling
- weak stopping rule
- wasteful verification

## Relationship To Capability Model

The taxonomy should map cleanly onto capability dimensions.

Not every failure class maps to exactly one dimension, but each class should have a primary impact.

Working mapping:

- goal understanding -> `planning`, `correctness`
- decomposition -> `planning`, `execution`
- tool use -> `toolProficiency`, `execution`
- recovery -> `recovery`, `robustness`
- safety -> `safetyDiscipline`
- observability -> `observability`
- robustness -> `robustness`
- efficiency -> `efficiency`, `costAwareness`

This mapping is important because it helps translate replay evidence into the capability graph.

## Relationship To Improvement Report

The improvement report should use this taxonomy directly.

Each important weakness in the report should be stated in terms of:

- `failure class`
- `failure subtype`
- `severity`
- `evidence`
- `likely improvement direction`

That keeps the report consistent across runs and versions.

## Relationship To Scenario Design

A good scenario pack should exercise one or more parts of the taxonomy intentionally.

Examples:

- interruption scenarios should target `recovery` and `robustness`
- red-line scenarios should target `safety`
- ambiguous-request scenarios should target `goal understanding`
- degraded-tool scenarios should target `tool use` and `recovery`

This gives scenario design a clearer purpose than just "make a hard task."

## Evidence Rules

A failure classification should only be assigned when the evidence supports it.

Examples:

- if the agent violated a stated red line, `safety failure` is direct
- if the agent gave a poor final report despite correct execution, `observability failure` is direct
- if the agent failed after a tool error and did not retry, `recovery failure` is direct

More speculative conclusions should be marked as inferred rather than direct.

## Direct Vs Inferred Classification

The taxonomy should support an evidence-strength distinction.

Recommended field:

- `evidenceMode: "direct" | "inferred"`

This avoids overstating weak conclusions.

Example:

- direct: the replay shows a missed blocker report
- inferred: the replay suggests weak decomposition, but evidence is partial

## V1 Scope

V1 does not need a perfect ontology.

A good first version is:

- 8 top-level classes
- a small subtype list for each
- 4 severity levels
- direct vs inferred evidence mode

That is enough to make reports and version comparisons much stronger than plain pass/fail.

## Risks

### 1. Overclassification

If every small issue gets a distinct label, the taxonomy becomes noise.

### 2. Underclassification

If everything becomes "execution failure," the taxonomy is useless.

### 3. Hidden Runtime Bias

If the taxonomy maps too tightly to OpenClaw or one tool model, it will not generalize.

### 4. Diagnosis Inflation

If too many failures are labeled `high` or `critical`, users lose prioritization.

## Working Rule

A useful classification should help answer:

`what kind of engineering change is most likely to reduce this failure next run?`

If a failure label does not help with that, it may be too vague or too narrow.

## Suggested Next Follow-Up

The next natural note or spec should define the structured schema for:

- `failurePattern`
- `suggestedChange`
- `improvementReport`

That would let the product direction notes turn into an implementable contract.
