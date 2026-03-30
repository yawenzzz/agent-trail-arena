# Trial Arena Product Direction Notes

## Context

This note captures the updated product direction for Trial Arena.

The project should no longer be framed primarily as a benchmark arena, leaderboard, or general-purpose agent evaluation UI. Those can exist later as surfaces, but they are not the product core.

The stronger product direction is:

`Trial Arena = agent employment standard + qualification + authorization infrastructure`

The target user is the `agent builder`, not the spectator.

This is for builders who already have one or more agents inside a framework or runtime and need to answer practical operating questions:

- which agent should take which task
- what level of responsibility each agent can safely carry
- where an agent's current boundary actually is
- what needs to improve before that agent can be trusted with more autonomy

## Product Thesis

`Trial Arena helps agent builders decide what an agent is qualified to do, what it is not yet qualified to do, and why.`

The project should behave more like:

- an HR qualification system
- a probation and promotion system
- a role and authorization control layer
- a regression harness for agent capability and responsibility

It should behave less like:

- a public benchmark site
- a one-shot scorecard
- a vanity leaderboard
- a generic chat playground

## Core User Problem

Agent builders do not only need to know whether an agent can sometimes complete a task.

They need to know:

- whether the agent can reliably handle a class of tasks
- whether it stays inside responsibility boundaries
- whether it escalates uncertainty correctly
- whether it reports blockers and incomplete work honestly
- whether it can be granted more autonomy without creating hidden operational risk

The real problem is not "who is strongest."

The real problem is:

`what can I safely and repeatedly delegate to this agent today?`

## Core User Value

The product should give the builder four outputs:

1. `Recommended grade`
What level of responsibility the agent currently qualifies for.

2. `Authorized scope`
What kind of tasks, ambiguity, and tooling authority the agent can currently be trusted with.

3. `Restricted scope`
What the builder should not yet authorize this agent to do.

4. `Promotion gaps`
What evidence-backed weaknesses must be fixed before the agent can take on more responsibility.

This makes the product useful for task assignment, limit setting, iteration planning, and regression control.

## Product Definition

Trial Arena should be positioned as:

- a local-first qualification system for agents
- a structured evidence and replay harness
- a failure diagnosis surface
- a grade evaluation and authorization system
- an iteration and promotion tracking tool

Trial Arena should not be positioned as:

- just another benchmark leaderboard
- a generic capability demo
- a full agent IDE
- a replacement for runtime-native configuration tools

## Employment Model

The right mental model is not "agent score."

The right mental model is:

`agent grade = authorization level`

That means grade is not a badge or a vanity label. Grade determines what kinds of responsibilities the builder can delegate to the agent.

Recommended V1 common ladder:

- `Intern`
- `Junior`
- `Mid`
- `Senior`
- `Lead`

Each grade should eventually define:

- the kinds of tasks the agent may own
- the ambiguity level it may handle
- the tools and risk level it may use autonomously
- when it must escalate to a human or higher-grade agent
- what behavior is required to retain that grade

## Responsibility-First Evaluation

The product should not assign grade from an average score.

The correct model is:

`run evidence -> diagnosis -> grade evaluation -> authorization decision`

This means Trial Arena is not just asking:

- did the task succeed
- how high was the score

It is asking:

- did the agent act within the required boundary
- did it report uncertainty and blockers
- did it recover when things went wrong
- did it use tools appropriately
- would a builder be justified in delegating this class of work again

## Capability Model

The existing capability dimensions remain useful, but they are no longer the final product output. They are evidence inputs to grade evaluation.

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

These dimensions help explain why an agent earned or failed to earn a certain grade.

## Failure Taxonomy

The failure taxonomy remains foundational, but its purpose is now more specific.

It is not only for diagnosis. It is for qualification and authorization decisions.

Useful high-level failure classes:

- goal misunderstanding
- poor decomposition
- tool misuse
- unsafe action
- hidden failure
- weak recovery
- low-quality reporting
- brittle execution under constraints

In the new product framing, certain failures do more than lower confidence. They can block grade promotion or narrow the agent's authorized scope.

Examples:

- `safety` failures can block higher-autonomy grades
- `observability` failures can block independent ownership
- `recovery` failures can block more complex task assignment
- `decomposition` failures can block higher-ambiguity work

## Output Model

A useful result should eventually contain:

- scenario result
- replay and evidence trail
- judge findings
- capability insights
- failure pattern classification
- improvement suggestions
- recommended grade
- authorized scope
- restricted scope
- promotion gaps
- version-to-version comparison hooks

The key rule remains:

`every visible conclusion should be supported by run evidence`

That now applies not only to diagnosis, but also to grade recommendation and authorization boundaries.

## Grade Evaluation

The top-level product output should become `GradeAssessment`.

That object should answer:

- what grade the agent currently qualifies for
- how confident the system is
- what it may be trusted to do
- what it must not yet be trusted to do
- what is blocking promotion
- what changes are recommended next

This is more useful to the builder than a plain score or findings list because it maps directly to task routing and organizational control.

## Desired User Loop

The intended workflow should become:

1. bring an agent into Trial Arena
2. run grade-relevant scenario packs
3. inspect evidence, replay, and diagnoses
4. review recommended grade and authorization scope
5. identify promotion gaps and blocking issues
6. revise skill, memory, prompts, tools, or workflow
7. re-run and compare the resulting grade trajectory

This makes Trial Arena part of continuous agent staffing and promotion, not just evaluation.

## What Makes The Product Valuable

The strongest version of this project is not:

`we can benchmark agents`

The stronger claim is:

`we help agent builders build, grade, authorize, limit, and promote digital workers using repeatable trials and evidence-backed judgments`

That makes the product closer to:

- an agent qualification system
- an agent authorization layer
- an agent coaching and promotion surface
- an agent regression harness

than to a static benchmark site.

## Open Source Direction

The open source core should remain useful locally and should support the qualification model directly.

Recommended open source surface:

- runtime adapter interfaces
- scenario and grade pack definitions
- run event model
- replay pipeline
- judge and grade evaluation interfaces
- capability and authorization scoring logic

Possible later hosted layer:

- shared scenario packs
- team dashboards
- historical grade tracking
- managed evaluators
- hosted comparison and reporting

The hosted layer should amplify the qualification workflow, not replace the local-first trust model.

## Community Contribution Model

A healthy community model likely has four contribution types:

1. `runtime adapters`
Examples: OpenClaw, Codex, and other agent runtimes.

2. `scenario packs`
Realistic tasks that measure execution and boundary handling.

3. `grade packs`
Scenario bundles aligned to responsibility levels such as Intern, Junior, Mid, Senior, and Lead.

4. `judge and grade evaluation modules`
Ways to classify behavior, risk, qualification, and promotion gaps.

This is stronger than only letting people submit agents to a ranking system.

## Strategic Product Risk

The biggest risk is still turning the project into benchmark theater:

- pretty charts
- lots of runs
- weak qualification meaning
- little guidance on delegation and limits

The healthier direction is:

- fewer vanity metrics
- stronger employment semantics
- clearer authorization boundaries
- stronger evidence and explanations
- clearer promotion logic

## What Trial Arena Should Optimize For

The product should primarily optimize for:

- repeatability
- explainability
- authorization clarity
- actionable diagnosis
- promotion guidance
- local-first trust

It should not primarily optimize for:

- vanity scores
- public ranking noise
- one-shot demos
- framework-specific lock-in

## Implication For Current Architecture

The current architecture direction is still useful if it is reinterpreted correctly.

The system should continue to support:

- multiple runtime adapters
- a shared `RunEvent` model
- replay independent of runtime session survival
- judge and grade evaluation running on stored evidence

That keeps the evidence layer runtime-agnostic while allowing the top-level qualification logic to evolve without coupling directly to any one runtime protocol.

## Suggested Near-Term Product Priorities

Before UI polish or public submission ideas, the next product questions to resolve are:

1. define the common grade ladder rigorously
2. define authorization boundaries for each grade
3. define grade packs that test responsibility, not only capability
4. define grade evaluation rules and blocking conditions
5. define the grade assessment output artifact

Only after that should the team optimize reports, comparison views, or broader UX surfaces.

## Working Principle

Trial Arena should not be just an evaluation destination.

It should become a recurring part of the builder's staffing workflow:

`build -> qualify -> authorize -> assign -> inspect -> revise -> re-qualify`

That is the loop worth protecting.
