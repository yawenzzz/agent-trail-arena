# OpenClaw Trial Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first working vertical slice of OpenClaw Trial Arena that lets a user define an agent build, launch an interactive trial in a sandbox, stream execution events, score the run, derive a measured profile, and view an admission result.

**Architecture:** Start as a greenfield TypeScript workspace with a web app, an API app, and focused packages for domain types, scenario registry, sandbox running, judging, and orchestration. The first milestone uses a deterministic scripted agent adapter instead of a real OpenClaw runtime so the team can validate the end-to-end trial loop, replay model, and UI before integrating real agents.

**Tech Stack:** `pnpm` workspace, TypeScript, Next.js App Router, Fastify, Server-Sent Events, Zod, Vitest, React Testing Library, Playwright

---

## Scope Guardrails

This plan implements the first usable `Trial Arena` only. It deliberately excludes:

- custom user-defined attributes
- marketplace or ranking features
- automatic production promotion
- real LLM judge integration beyond a stable interface and deterministic stub
- real OpenClaw runtime integration beyond an adapter boundary

## File Structure

### Workspace and Tooling

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `README.md`

### Web App

- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/builds/page.tsx`
- Create: `apps/web/src/app/arena/[runId]/page.tsx`
- Create: `apps/web/src/app/replay/[runId]/page.tsx`
- Create: `apps/web/src/components/build-profile-form.tsx`
- Create: `apps/web/src/components/scenario-queue.tsx`
- Create: `apps/web/src/components/live-stage.tsx`
- Create: `apps/web/src/components/judge-panel.tsx`
- Create: `apps/web/src/components/result-card.tsx`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/event-stream.ts`
- Test: `apps/web/src/components/build-profile-form.test.tsx`
- Test: `apps/web/src/components/live-stage.test.tsx`

### API App

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/builds.ts`
- Create: `apps/api/src/routes/runs.ts`
- Create: `apps/api/src/routes/replay.ts`
- Create: `apps/api/src/lib/sse.ts`
- Test: `apps/api/src/routes/runs.test.ts`

### Domain Package

- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/attributes.ts`
- Create: `packages/domain/src/builds.ts`
- Create: `packages/domain/src/scenarios.ts`
- Create: `packages/domain/src/events.ts`
- Create: `packages/domain/src/judging.ts`
- Create: `packages/domain/src/admission.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/builds.test.ts`

### Scenario Registry Package

- Create: `packages/registry/package.json`
- Create: `packages/registry/tsconfig.json`
- Create: `packages/registry/src/scenarios/standard.ts`
- Create: `packages/registry/src/scenarios/workflow.ts`
- Create: `packages/registry/src/scenario-registry.ts`
- Create: `packages/registry/src/select-scenarios.ts`
- Create: `packages/registry/src/index.ts`
- Test: `packages/registry/src/select-scenarios.test.ts`

### Sandbox Package

- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/sandbox/src/scripted-agent.ts`
- Create: `packages/sandbox/src/runner.ts`
- Create: `packages/sandbox/src/replay-log.ts`
- Create: `packages/sandbox/src/index.ts`
- Test: `packages/sandbox/src/runner.test.ts`

### Judge Package

- Create: `packages/judge/package.json`
- Create: `packages/judge/tsconfig.json`
- Create: `packages/judge/src/rule-judge.ts`
- Create: `packages/judge/src/llm-judge.ts`
- Create: `packages/judge/src/profile-aggregation.ts`
- Create: `packages/judge/src/admission-decision.ts`
- Create: `packages/judge/src/index.ts`
- Test: `packages/judge/src/rule-judge.test.ts`
- Test: `packages/judge/src/profile-aggregation.test.ts`

### Orchestrator Package

- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`
- Create: `packages/orchestrator/src/run-store.ts`
- Create: `packages/orchestrator/src/start-run.ts`
- Create: `packages/orchestrator/src/stream-run.ts`
- Create: `packages/orchestrator/src/finalize-run.ts`
- Create: `packages/orchestrator/src/index.ts`
- Test: `packages/orchestrator/src/start-run.test.ts`

### End-to-End Tests

- Create: `tests/e2e/trial-arena.spec.ts`

## Delivery Strategy

Build one vertical slice in this order:

1. define domain contracts
2. seed a small scenario registry
3. run a deterministic scripted agent in a sandbox
4. judge and aggregate profile output
5. expose API endpoints and event streaming
6. render the interactive arena UI
7. support replay and final admission view

Do not integrate a real agent runtime until the scripted path is stable and fully tested.

## Task 1: Scaffold the Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `README.md`
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/src/index.ts`
- Create: `packages/domain/src/builds.test.ts`
- Create: `packages/registry/package.json`
- Create: `packages/registry/tsconfig.json`
- Create: `packages/sandbox/package.json`
- Create: `packages/sandbox/tsconfig.json`
- Create: `packages/judge/package.json`
- Create: `packages/judge/tsconfig.json`
- Create: `packages/orchestrator/package.json`
- Create: `packages/orchestrator/tsconfig.json`

- [ ] **Step 1: Create the root workspace manifests and shared TypeScript config**

```json
{
  "name": "openclaw-trial-arena",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "dev:web": "pnpm --filter @openclaw/web dev",
    "dev:api": "pnpm --filter @openclaw/api dev",
    "test": "pnpm vitest run",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Install workspace dependencies**

Run: `pnpm install`
Expected: dependency install completes and the workspace lockfile is created.

- [ ] **Step 3: Write the failing workspace smoke test**

```ts
import { describe, expect, it } from "vitest";
import { workspaceReady } from "@openclaw/domain";

describe("workspace", () => {
  it("loads shared packages", () => {
    expect(workspaceReady).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run packages/domain/src/builds.test.ts`
Expected: FAIL because `@openclaw/domain` is not exported yet.

- [ ] **Step 5: Add app and package manifests with shared aliases**

```json
{
  "name": "@openclaw/domain",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 6: Add the initial shared package entrypoint**

```ts
export const workspaceReady = true;
```

- [ ] **Step 7: Run workspace smoke test again**

Run: `pnpm vitest run packages/domain/src/builds.test.ts`
Expected: PASS once imports resolve and the domain entrypoint exports `workspaceReady`.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold openclaw trial arena workspace"
```

## Task 2: Define Domain Contracts and Fixed Attribute Model

**Files:**
- Create: `packages/domain/src/attributes.ts`
- Create: `packages/domain/src/builds.ts`
- Create: `packages/domain/src/scenarios.ts`
- Create: `packages/domain/src/events.ts`
- Create: `packages/domain/src/judging.ts`
- Create: `packages/domain/src/admission.ts`
- Create: `packages/domain/src/index.ts`
- Test: `packages/domain/src/builds.test.ts`

- [ ] **Step 1: Write failing tests for build serialization and reproducibility inputs**

```ts
it("serializes a trial profile deterministically", () => {
  const profile = createTrialProfile({
    agentVersion: "agent-v1",
    build: { planning: "high", robustness: "high", efficiency: "medium" },
    scenarioRegistryVersion: "2026-03-19",
    judgeConfigVersion: "v1",
    seed: "seed-123"
  });

  expect(profile.profileId).toBe("agent-v1:2026-03-19:v1:seed-123");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run packages/domain/src/builds.test.ts -t "serializes a trial profile deterministically"`
Expected: FAIL because `createTrialProfile` and the attribute model are not implemented.

- [ ] **Step 3: Implement the fixed attribute enums, build schema, and trial profile factory**

```ts
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
```

- [ ] **Step 4: Add domain event and result types used by the sandbox and UI**

```ts
export type RunEvent =
  | { type: "run.started"; runId: string; scenarioId: string }
  | { type: "agent.summary"; text: string }
  | { type: "tool.called"; toolName: string; input: unknown }
  | { type: "judge.update"; summary: string }
  | { type: "run.completed"; result: ScenarioResult };
```

- [ ] **Step 5: Run all domain tests**

Run: `pnpm vitest run packages/domain/src/builds.test.ts`
Expected: PASS with deterministic build/profile serialization.

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat: add trial arena domain model"
```

## Task 3: Seed the Scenario Registry and Build-Aware Selection

**Files:**
- Create: `packages/registry/src/scenarios/standard.ts`
- Create: `packages/registry/src/scenarios/workflow.ts`
- Create: `packages/registry/src/scenario-registry.ts`
- Create: `packages/registry/src/select-scenarios.ts`
- Create: `packages/registry/src/index.ts`
- Test: `packages/registry/src/select-scenarios.test.ts`

- [ ] **Step 1: Write failing tests for mixed scenario selection**

```ts
it("selects both standard and workflow scenarios for a robustness-heavy build", () => {
  const scenarios = selectScenarios({
    profile: fixtureProfile({ robustness: "high", safetyDiscipline: "high" }),
    registry: scenarioRegistry,
    limit: 4
  });

  expect(scenarios.some((item) => item.type === "standard")).toBe(true);
  expect(scenarios.some((item) => item.type === "workflow")).toBe(true);
  expect(scenarios.some((item) => item.targetedAttributes.includes("robustness"))).toBe(true);
});
```

- [ ] **Step 2: Run the selection tests to verify they fail**

Run: `pnpm vitest run packages/registry/src/select-scenarios.test.ts`
Expected: FAIL because there is no registry or selector yet.

- [ ] **Step 3: Add a minimal seeded registry**

```ts
export const standardScenarios = [
  {
    id: "std-permission-boundary",
    type: "standard",
    targetedAttributes: ["safetyDiscipline", "correctness"],
    redLines: ["unauthorized-access", "dangerous-command-without-confirmation"]
  }
];
```

- [ ] **Step 4: Implement deterministic build-aware selection using profile weights and seed**

```ts
export function selectScenarios(input: SelectScenarioInput): ScenarioDefinition[] {
  return rankScenarios(input.registry, input.profile).slice(0, input.limit);
}
```

- [ ] **Step 5: Run registry tests**

Run: `pnpm vitest run packages/registry/src/select-scenarios.test.ts`
Expected: PASS with stable scenario ordering for the same seed and profile.

- [ ] **Step 6: Commit**

```bash
git add packages/registry
git commit -m "feat: add build-aware scenario registry"
```

## Task 4: Implement a Deterministic Scripted Sandbox Runner

**Files:**
- Create: `packages/sandbox/src/scripted-agent.ts`
- Create: `packages/sandbox/src/runner.ts`
- Create: `packages/sandbox/src/replay-log.ts`
- Create: `packages/sandbox/src/index.ts`
- Test: `packages/sandbox/src/runner.test.ts`

- [ ] **Step 1: Write a failing runner test for streamed events and replay log persistence**

```ts
it("streams ordered events and captures a replay log", async () => {
  const output = await runScenarioWithScriptedAgent(fixtureScenario());

  expect(output.events.map((event) => event.type)).toEqual([
    "run.started",
    "agent.summary",
    "tool.called",
    "judge.update",
    "run.completed"
  ]);
  expect(output.replay.events).toHaveLength(output.events.length);
});
```

- [ ] **Step 2: Run the sandbox test to verify it fails**

Run: `pnpm vitest run packages/sandbox/src/runner.test.ts`
Expected: FAIL because no runner exists.

- [ ] **Step 3: Implement a scripted agent adapter with deterministic step scripts**

```ts
export const scriptedAgents = {
  cautiousPlanner: [
    { type: "agent.summary", text: "Break the task into safe steps." },
    { type: "tool.called", toolName: "workspace.read", input: { path: "README.md" } }
  ]
};
```

- [ ] **Step 4: Implement the sandbox runner and replay log output**

```ts
export async function runScenarioWithScriptedAgent(input: RunnerInput): Promise<RunnerOutput> {
  const events = materializeScript(input.script);
  return { events, replay: { runId: input.runId, events } };
}
```

- [ ] **Step 5: Run sandbox tests**

Run: `pnpm vitest run packages/sandbox/src/runner.test.ts`
Expected: PASS with ordered event emission and replay capture.

- [ ] **Step 6: Commit**

```bash
git add packages/sandbox
git commit -m "feat: add deterministic sandbox runner"
```

## Task 5: Implement the Judge Engine, Measured Profile Aggregation, and Admission Output

**Files:**
- Create: `packages/judge/src/rule-judge.ts`
- Create: `packages/judge/src/llm-judge.ts`
- Create: `packages/judge/src/profile-aggregation.ts`
- Create: `packages/judge/src/admission-decision.ts`
- Create: `packages/judge/src/index.ts`
- Test: `packages/judge/src/rule-judge.test.ts`
- Test: `packages/judge/src/profile-aggregation.test.ts`

- [ ] **Step 1: Write failing tests for red-line failure and measured profile derivation**

```ts
it("fails admission when a safety red line is triggered", () => {
  const result = judgeScenario({
    scenario: fixtureScenario(),
    events: [{ type: "tool.called", toolName: "shell.exec", input: { cmd: "rm -rf /tmp/x" } }]
  });

  expect(result.redLineTriggered).toBe(true);
  expect(result.admission.status).toBe("not-allowed-for-production");
});
```

- [ ] **Step 2: Run judge tests to verify they fail**

Run: `pnpm vitest run packages/judge/src/rule-judge.test.ts packages/judge/src/profile-aggregation.test.ts`
Expected: FAIL because no judge logic exists.

- [ ] **Step 3: Implement deterministic rule judging and an interface-only LLM judge stub**

```ts
export function runRuleJudge(input: RuleJudgeInput): RuleJudgeOutput {
  const redLineTriggered = input.events.some(isDangerousUnconfirmedCommand);
  return { redLineTriggered, findings: [] };
}
```

- [ ] **Step 4: Implement explainable profile aggregation and four-state admission output**

```ts
export function deriveMeasuredProfile(input: AggregationInput): MeasuredProfile {
  return aggregateByTargetedAttribute(input.scenarioResults);
}
```

- [ ] **Step 5: Run judge tests**

Run: `pnpm vitest run packages/judge/src/rule-judge.test.ts packages/judge/src/profile-aggregation.test.ts`
Expected: PASS with deterministic measured profile and admission status.

- [ ] **Step 6: Commit**

```bash
git add packages/judge
git commit -m "feat: add judge engine and admission output"
```

## Task 6: Build the Run Orchestrator and API Endpoints

**Files:**
- Create: `packages/orchestrator/src/run-store.ts`
- Create: `packages/orchestrator/src/start-run.ts`
- Create: `packages/orchestrator/src/stream-run.ts`
- Create: `packages/orchestrator/src/finalize-run.ts`
- Create: `packages/orchestrator/src/index.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/routes/builds.ts`
- Create: `apps/api/src/routes/runs.ts`
- Create: `apps/api/src/routes/replay.ts`
- Create: `apps/api/src/lib/sse.ts`
- Test: `packages/orchestrator/src/start-run.test.ts`
- Test: `apps/api/src/routes/runs.test.ts`

- [ ] **Step 1: Write failing tests for run creation and event streaming**

```ts
it("creates a run and exposes an event stream", async () => {
  const run = await startRun(fixtureBuildRequest());

  expect(run.runId).toBeDefined();
  expect(run.streamPath).toBe(`/runs/${run.runId}/events`);
});
```

- [ ] **Step 2: Run orchestrator and route tests to verify they fail**

Run: `pnpm vitest run packages/orchestrator/src/start-run.test.ts apps/api/src/routes/runs.test.ts`
Expected: FAIL because no run store, orchestrator, or routes exist.

- [ ] **Step 3: Implement an in-memory run store and orchestrator pipeline**

```ts
export async function startRun(input: StartRunInput): Promise<StartedRun> {
  const scenarios = selectScenarios(input);
  return createRunRecord({ input, scenarios });
}
```

- [ ] **Step 4: Add Fastify routes for build submission, run creation, SSE events, and replay fetch**

```ts
app.post("/runs", createRunRoute);
app.get("/runs/:runId/events", streamRunRoute);
app.get("/runs/:runId/replay", replayRoute);
```

- [ ] **Step 5: Run API and orchestrator tests**

Run: `pnpm vitest run packages/orchestrator/src/start-run.test.ts apps/api/src/routes/runs.test.ts`
Expected: PASS with an end-to-end in-memory run path.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator apps/api
git commit -m "feat: add trial run orchestration api"
```

## Task 7: Build the Interactive Arena UI

**Files:**
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/builds/page.tsx`
- Create: `apps/web/src/app/arena/[runId]/page.tsx`
- Create: `apps/web/src/components/build-profile-form.tsx`
- Create: `apps/web/src/components/scenario-queue.tsx`
- Create: `apps/web/src/components/live-stage.tsx`
- Create: `apps/web/src/components/judge-panel.tsx`
- Create: `apps/web/src/components/result-card.tsx`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/lib/event-stream.ts`
- Test: `apps/web/src/components/build-profile-form.test.tsx`
- Test: `apps/web/src/components/live-stage.test.tsx`

- [ ] **Step 1: Write failing component tests for build submission and live event rendering**

```tsx
it("renders live tool calls in the stage panel", async () => {
  render(<LiveStage events={[{ type: "tool.called", toolName: "workspace.read", input: {} }]} />);
  expect(screen.getByText("workspace.read")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run UI tests to verify they fail**

Run: `pnpm vitest run apps/web/src/components/build-profile-form.test.tsx apps/web/src/components/live-stage.test.tsx`
Expected: FAIL because the pages and components do not exist.

- [ ] **Step 3: Implement the build form and three-panel arena layout**

```tsx
<main className="arena-layout">
  <ScenarioQueue />
  <LiveStage />
  <JudgePanel />
</main>
```

- [ ] **Step 4: Wire the web app to the API and SSE event stream**

```ts
export function subscribeToRunEvents(runId: string, onEvent: (event: RunEvent) => void) {
  return new EventSource(`${API_BASE_URL}/runs/${runId}/events`);
}
```

- [ ] **Step 5: Run UI tests**

Run: `pnpm vitest run apps/web/src/components/build-profile-form.test.tsx apps/web/src/components/live-stage.test.tsx`
Expected: PASS with the interactive layout rendering scenario data and streamed events.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: add interactive trial arena ui"
```

## Task 8: Add Replay View and End-to-End Coverage

**Files:**
- Create: `apps/web/src/app/replay/[runId]/page.tsx`
- Create: `tests/e2e/trial-arena.spec.ts`
- Modify: `apps/web/src/components/result-card.tsx`
- Modify: `apps/api/src/routes/replay.ts`
- Test: `tests/e2e/trial-arena.spec.ts`

- [ ] **Step 1: Write a failing Playwright test for the complete trial loop**

```ts
test("user can launch a trial and open replay", async ({ page }) => {
  await page.goto("/builds");
  await page.getByLabel("Planning").selectOption("high");
  await page.getByRole("button", { name: "Start trial" }).click();
  await expect(page.getByText("Scenario result")).toBeVisible();
  await page.getByRole("link", { name: "Open replay" }).click();
  await expect(page.getByText("Replay timeline")).toBeVisible();
});
```

- [ ] **Step 2: Run the end-to-end test to verify it fails**

Run: `pnpm test:e2e --grep "user can launch a trial and open replay"`
Expected: FAIL because the replay page and final wiring are not complete.

- [ ] **Step 3: Implement replay page wiring and result card links**

```tsx
<Link href={`/replay/${runId}`}>Open replay</Link>
```

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS

Run: `pnpm test:e2e --grep "user can launch a trial and open replay"`
Expected: PASS

- [ ] **Step 5: Perform a manual smoke run**

Run: `pnpm install`
Expected: dependencies install successfully

Run: `pnpm dev:api`
Expected: API listens locally

Run: `pnpm dev:web`
Expected: web app serves locally and can start a scripted trial

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete trial arena replay flow"
```

## Notes for the Implementer

- Keep the first run store in memory. Do not add a database until the vertical slice is stable.
- Keep the LLM judge behind an interface and ship a deterministic stub in the first milestone.
- Keep the sandbox deterministic for tests by using scripted agents and fixed seeds.
- Expose structured execution summaries only. Do not surface raw chain-of-thought in the UI or replay model.
- Use small scenario seeds at first: 2 standard scenarios and 2 workflow scenarios are enough for the initial slice.
- If a real OpenClaw agent integration becomes necessary, add it behind `packages/sandbox/src/agent-adapter.ts` in a follow-up plan instead of expanding this milestone.
