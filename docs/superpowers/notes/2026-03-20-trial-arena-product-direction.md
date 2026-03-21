# Trial Arena Product Direction Notes

## Context

This note captures the product discussion around where Trial Arena should go beyond a demo benchmark UI.

The core intent is not just to run an agent once and show a score. The product should become a practical environment where OpenClaw users and users of other agent runtimes can bring an agent into the arena, understand its current capability shape, and improve it through repeated trial loops.

## Product Thesis

`Trial Arena = a proving ground + an improvement loop for agents`

It should not stop at:

- running a benchmark
- showing pass/fail
- producing a leaderboard

It should do two jobs well:

1. evaluate the agent's current capability
2. help the user improve that capability with evidence-backed guidance

If Trial Arena only acts as a scoring surface, it will be low-retention and easy to replace.
If it becomes part of the user's agent engineering loop, it can be sticky and strategically valuable.

## Core User Value

The user should get two outputs from every trial run:

1. `Capability visibility`
The user sees a credible multi-dimensional picture of what the agent is actually good at.

2. `Actionable improvement guidance`
The user understands what failed, why it failed, what kind of weakness it represents, and what to change next.

This means the product output cannot be just "score" or "rank". It needs to become a diagnosis and iteration surface.

## Desired User Loop

The intended workflow is:

1. bring an agent into Trial Arena
2. run standardized but realistic trials
3. inspect the capability graph and replay evidence
4. inspect failure patterns and judge findings
5. receive suggested next improvements
6. revise the agent
7. re-run and compare version-to-version changes

This makes Trial Arena part of continuous agent improvement, not just one-time evaluation.

## Product Definition

Trial Arena should be positioned as:

- a local-first and eventually open ecosystem for agent trials
- a structured evaluation harness
- a capability graph generator
- a failure diagnosis surface
- a comparison and iteration tool

It should not be positioned as:

- just another benchmark leaderboard
- a generic chat playground
- a full agent IDE
- a full replacement for runtime-native configuration tools

## Capability Model

A stable capability model is foundational.
The product needs a fixed, explainable set of dimensions that can survive across runtimes, scenarios, and versions.

Current working dimensions:

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

These dimensions matter because they let Trial Arena answer:

- what the agent claims
- what the agent demonstrated
- where the claim and the evidence diverge

The capability graph should therefore represent not only "strength" but also "credibility of that strength under trial pressure."

## Failure Taxonomy

The second foundational layer is a reusable failure taxonomy.

The system should not only say that a run failed. It should classify why.

Useful high-level failure classes:

- goal misunderstanding
- poor decomposition
- tool misuse
- unsafe action
- hidden failure
- weak recovery
- low-quality reporting
- brittle execution under constraints

This taxonomy is important because it is what turns a replay into a coaching artifact.

## Output Model

A useful run result should eventually contain:

- scenario result
- multi-dimensional capability graph
- judge findings
- admission outcome
- failure pattern classification
- evidence-backed improvement suggestions
- version-to-version comparison hooks

The key rule is:

`every visible conclusion should be supported by run evidence`

That means the arena timeline, replay, and judge outputs are not decorative. They are the proof behind the capability picture.

## What Makes The Product Valuable

The strongest version of this project is not "we can benchmark agents."

The stronger claim is:

`we can help an agent builder improve an agent using repeatable trials, structured evidence, and versioned feedback`

That makes the product closer to:

- an agent evaluation framework
- an agent coaching surface
- an agent regression harness

than to a static benchmark site.

## Open Source Direction

The project should be designed to work as an open source core.

Recommended open source surface:

- runtime adapter interfaces
- scenario definitions and packs
- run event model
- replay pipeline
- judge interfaces
- capability scoring logic

Possible later hosted layer:

- shared leaderboard
- hosted scenario packs
- team dashboards
- managed judge services
- historical comparison UI

The open source version should already be useful locally.
Otherwise the project will feel like marketing for a hosted product rather than a real tool.

## Community Contribution Model

A healthy community model likely has three contribution types:

1. `runtime adapters`
Examples: OpenClaw, Codex, and other agent runtimes.

2. `scenario packs`
Realistic trials that test specific capabilities or failure modes.

3. `judge rules and analysis modules`
Ways to classify performance, risk, and admission readiness.

This is a better long-term contribution surface than only allowing people to submit agents to be ranked.

## Strategic Product Risk

The biggest risk is turning Trial Arena into a "benchmark theater" product:

- pretty charts
- lots of runs
- little practical guidance

That would create low repeat usage.

The healthier direction is:

- fewer metrics
- stronger explanations
- clearer failure localization
- stronger next-step guidance

## What Trial Arena Should Optimize For

The product should primarily optimize for:

- repeatability
- explainability
- version comparison
- actionable diagnosis
- local-first trust

It should not primarily optimize for:

- vanity scores
- public ranking noise
- one-shot demos
- framework-specific lock-in

## Implication For Current Architecture

The current architecture should continue to support:

- multiple runtime adapters
- a shared `RunEvent` model
- replay independent of runtime session survival
- judge and admission running on stored evidence

That is the right direction because it supports future runtimes without forcing the UI and judge pipeline to understand each raw runtime protocol directly.

## Suggested Near-Term Product Priorities

Before broadening UI polish or public submission flows, the next product questions to resolve are:

1. define the capability model more rigorously
2. define the failure taxonomy more rigorously
3. define what the user receives as an "improvement report"
4. define how version-to-version comparison should work

The reasoning is simple:

- without a stable capability model, the graph is weak
- without a failure taxonomy, the diagnosis is weak
- without an improvement report, the product does not help users get better
- without version comparison, repeated use loses value

## Working Principle

Trial Arena should not be just an evaluation destination.

It should become a recurring part of the agent builder's workflow:

`build -> trial -> inspect -> revise -> re-trial`

That is the product loop worth protecting.

## Open Questions

These should be resolved in future notes or specs:

- What exact capability dimensions are stable enough to ship as first-class product language?
- How should "declared build" and "measured build" differ in the UI and the judge pipeline?
- What should an improvement report look like after one run?
- How should version comparison be represented?
- What should be open source by default, and what should remain optional or hosted later?
- How much of the product should be local-first versus collaborative or cloud-backed?
