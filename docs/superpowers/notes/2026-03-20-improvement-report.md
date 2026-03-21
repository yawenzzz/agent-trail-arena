# Trial Arena Improvement Report Notes

## Goal

Define what a user should receive after one trial run so that Trial Arena is useful for improving an agent, not just scoring it.

This note focuses on the output artifact after a run:

`trial result -> diagnosis -> recommended next changes`

## Core Principle

The improvement report should answer 4 questions:

1. what happened
2. what that says about the agent's capability
3. why it happened
4. what to change next

If the report cannot answer the fourth question, it is still only an evaluation report.

## Product Role

The improvement report is the bridge between:

- replay evidence
- judge output
- capability graph
- the user's next engineering action

It is the main artifact that turns Trial Arena into an iteration loop.

## Required Outcomes

After reading one report, a user should be able to say:

- what the agent did well
- what the agent did badly
- which failures matter most
- what kind of weakness those failures represent
- which 1 to 3 changes are most worth trying next

## Report Structure

The report should eventually have these sections.

### 1. Executive Summary

Short, blunt, readable.

It should contain:

- overall outcome
- top capability signal
- top failure signal
- recommendation on whether the agent is ready for the claimed use

Example:

`The agent completed the workflow but showed weak recovery and low observability. It can handle straightforward tasks, but it is not yet reliable under interruption or partial failure.`

### 2. Capability Shape

This is the human-readable interpretation of the capability graph.

It should answer:

- which dimensions are strongest
- which dimensions are weakest
- where declared capability and measured capability diverge

This section should not just repeat chart values. It should interpret them.

Example:

- strong planning and tool use
- weak recovery under failure
- safety discipline acceptable but poorly surfaced in final reporting

### 3. Failure Diagnosis

This is where Trial Arena becomes useful.

It should identify:

- the most important failure patterns
- the severity of each one
- the evidence behind each one
- the likely root-cause category

Each diagnosis entry should include:

- `failure class`
- `severity`
- `evidence`
- `impact`
- `likely cause`

Example:

- failure class: `weak recovery`
- severity: `high`
- evidence: the agent hit a tool failure and did not retry or degrade gracefully
- impact: the workflow stopped even though a safe fallback was possible
- likely cause: missing retry policy or weak error-handling prompt structure

### 4. Evidence Anchors

Every meaningful conclusion in the report should point to evidence.

Evidence anchors can reference:

- replay timestamps
- event ids
- tool calls
- assistant summaries
- terminal result transitions

This matters for trust.
The user should never feel that Trial Arena is inventing a diagnosis without support.

### 5. Suggested Improvements

This is the most important section.

The report should recommend:

- what to change
- why this change matters
- which capability dimension it is expected to improve
- what kind of re-test should follow

The format should be pragmatic, not academic.

Example:

- add an explicit retry-and-fallback policy after tool errors
- require the agent to summarize uncertainty before taking irreversible actions
- tighten the final response contract so the agent must report blockers and incomplete work

### 6. Re-Test Recommendation

The report should suggest what to run next.

Not every weakness should lead to the same re-test.

Examples:

- if recovery is weak, run more interruption and degraded-tool scenarios
- if safety is weak, run more red-line and policy-boundary scenarios
- if observability is weak, run scenarios that require explicit status reporting and uncertainty handling

This is how Trial Arena starts to guide the next loop instead of only judging the last one.

## Improvement Report Inputs

The report should be derived from:

- scenario definition
- run events
- replay
- judge findings
- admission result
- declared build
- measured build

It should not depend on hidden or non-reproducible heuristics.

## Improvement Report Outputs

The report should produce structured fields, not just prose.

Recommended output model:

- `summary`
- `strengths`
- `weaknesses`
- `failurePatterns`
- `evidenceAnchors`
- `suggestedChanges`
- `retestRecommendations`
- `confidence`

This matters because later UI, version comparison, and APIs will want structured data.

## Suggested Change Model

Each suggested change should be machine-readable enough to group and compare later.

Recommended fields:

- `title`
- `description`
- `priority`
- `expectedImpactDimensions`
- `changeType`
- `reason`
- `recommendedRetest`

Useful `changeType` values:

- `prompting`
- `tooling`
- `workflow`
- `guardrail`
- `reporting`
- `runtime`

This lets Trial Arena say not only "improve recovery" but also "this looks like a workflow change, not a tooling change."

## Confidence Model

The report should communicate uncertainty.

Not all conclusions should be stated equally strongly.

Suggested confidence levels:

- `high`
- `medium`
- `low`

Confidence should depend on:

- how much evidence exists
- whether the failure repeated
- whether multiple signals point to the same weakness
- whether the judgment is direct or inferred

This is important because otherwise the report will sound more certain than the evidence allows.

## Good Report Characteristics

A good report is:

- concise
- evidence-backed
- actionable
- specific about next steps
- honest about uncertainty

A bad report is:

- generic
- score-heavy
- repetitive
- disconnected from replay evidence
- vague about what to change

## V1 Scope

The first shippable version does not need full sophistication.

A useful V1 report can be:

- one executive summary
- top 3 strengths
- top 3 weaknesses
- top 3 failure patterns
- top 3 suggested next changes
- one recommended re-test direction

That is enough to prove the product value.

## V1 Generation Logic

For V1, the report can be produced by combining:

- rule-based judge outputs
- simple event-pattern extraction
- declared vs measured capability diffs

This is enough to generate deterministic, inspectable reports before introducing more advanced judge logic.

## Relationship To Capability Model

The improvement report should not replace the capability graph.

The relationship should be:

- graph shows the shape
- report explains the shape
- replay proves the explanation
- suggested changes drive the next iteration

## Relationship To Version Comparison

The report should be designed so two reports can later be compared.

That implies stable fields for:

- failure classes
- capability dimensions
- suggested change types

Without stable structure, version-to-version comparison becomes subjective and noisy.

## Risks

There are a few obvious failure modes for this feature.

### 1. Generic Advice

If the report sounds like generic AI coaching, users will stop trusting it.

### 2. Overclaiming

If the report presents weak evidence as strong diagnosis, it will feel fake.

### 3. Too Much Detail

If the report becomes a dense wall of text, it will not change user behavior.

### 4. No Prioritization

If everything looks important, nothing is actionable.

## Working Rule

Each report should aim to answer:

`If the user only fixes one thing before the next run, what should it be?`

That constraint forces prioritization.

## Suggested Next Follow-Up

The next note or spec should define one of these:

1. the exact `failure taxonomy`
2. the exact structured schema for `improvement report`
3. the logic for deriving `declared build vs measured build gap`

The most natural next step is probably the failure taxonomy, because it is the backbone of a believable report.
