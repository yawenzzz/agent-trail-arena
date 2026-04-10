# Codex Provider Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Codex agent support to Trial Arena by introducing a unified provider/runtime abstraction that keeps OpenClaw working while enabling provider-aware agent resolve, provision, selection, and run execution.

**Architecture:** Introduce shared provider-aware types across web/API/orchestrator, add unified `/agents/*` routes with OpenClaw compatibility shims, implement a workspace-local Codex preset store plus Codex runner adapter in `packages/sandbox`, and route `/runs` through normalized provider-agent runtime dispatch.

**Tech Stack:** TypeScript, Fastify, React/Next.js client components, Vitest, local Codex CLI, existing OpenClaw gateway integration.

---

## File Structure

### Shared type and client surface
- Modify: `apps/web/src/lib/trial-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Modify: `apps/web/src/components/build-profile-form.test.tsx`

### Unified provider API surface
- Create: `apps/api/src/routes/agents.ts`
- Modify: `apps/api/src/routes/openclaw.ts`
- Modify: `apps/api/src/routes/openclaw.test.ts`
- Modify: `apps/api/src/app.ts`

### Run request normalization and dispatch
- Modify: `apps/api/src/routes/runs.ts`
- Modify: `apps/api/src/routes/runs.test.ts`
- Modify: `packages/orchestrator/src/start-run.ts`
- Modify: `packages/orchestrator/src/start-run.test.ts`

### Codex sandbox adapter
- Create: `packages/sandbox/src/codex/types.ts`
- Create: `packages/sandbox/src/codex/agent-id.ts`
- Create: `packages/sandbox/src/codex/workspace-store.ts`
- Create: `packages/sandbox/src/codex/workspace-resolver.ts`
- Create: `packages/sandbox/src/codex/agent-provisioner.ts`
- Create: `packages/sandbox/src/codex/runner.ts`
- Modify: `packages/sandbox/src/index.ts`
- Create: `packages/sandbox/src/codex/agent-id.test.ts`
- Create: `packages/sandbox/src/codex/workspace-store.test.ts`
- Create: `packages/sandbox/src/codex/workspace-resolver.test.ts`
- Create: `packages/sandbox/src/codex/agent-provisioner.test.ts`
- Create: `packages/sandbox/src/codex/runner.test.ts`

### Design and regression artifacts
- Modify: `docs/superpowers/specs/2026-04-10-codex-provider-runtime-design.md` (only if implementation reveals spec-level corrections)
- Modify: `README.md` (document Codex support after code is green)

---

### Task 1: Add shared provider/runtime types to web payloads

**Files:**
- Modify: `apps/web/src/lib/trial-types.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Test: `apps/web/src/components/build-profile-form.test.tsx`

- [ ] **Step 1: Write the failing web test expectations for provider-aware payloads**

Update `apps/web/src/components/build-profile-form.test.tsx` to assert only that `createRunRequest(...)` produces `runtime.kind = "provider-agent"` for provider-backed runs. Leave provider-selection UI and provider-specific copy assertions to Task 2.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/web/src/components/build-profile-form.test.tsx`
Expected: FAIL because current form and payload are OpenClaw-only.

- [ ] **Step 3: Implement shared trial/web types and API client contracts**

Update `apps/web/src/lib/trial-types.ts` to introduce:
- `AgentProvider`
- discriminated `AgentDescriptor`
- discriminated `ResolvedAgentWorkspace`
- `ProviderAgentRuntimeTarget`
- `RunRequestRuntime`

Update `apps/web/src/lib/api-client.ts` to:
- replace OpenClaw-only resolve/provision helpers with unified `resolveAgents(...)` and `provisionAgent(...)`
- keep any temporary OpenClaw wrappers only if needed by unchanged call sites
- update `CreateRunRequest` to use the new runtime type

Update `apps/web/src/components/build-profile-form.tsx` only as needed to keep the shared `createRunRequest(...)` helper aligned with the new provider-aware runtime type.

- [ ] **Step 4: Run web type/form test to verify it passes**

Run: `pnpm exec vitest run apps/web/src/components/build-profile-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add apps/web/src/lib/trial-types.ts apps/web/src/lib/api-client.ts apps/web/src/components/build-profile-form.test.tsx
git commit
```

Use a Lore-format commit message if checkpointing. Skip this checkpoint if the workspace is still in a partial migration state.

### Task 2: Make build form provider-aware

**Files:**
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Optional create: `apps/web/src/lib/provider-form-state.ts`
- Test: `apps/web/src/components/build-profile-form.test.tsx`

- [ ] **Step 1: Write failing test coverage for provider switching state resets**

Add assertions to `apps/web/src/components/build-profile-form.test.tsx` for:
- provider switch UI renders both OpenClaw and Codex options
- Codex mode copy references workspace root instead of OpenClaw state root

If provider-switch reset behavior is too hard to verify through current static markup rendering, first extract reset logic into a pure helper such as `apps/web/src/lib/provider-form-state.ts`, then add unit tests for that helper to lock:
- switching provider clears incompatible provider context
- switching provider clears resolved agents
- switching provider clears selected agent and provider-specific errors

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/web/src/components/build-profile-form.test.tsx`
Expected: FAIL because the component is OpenClaw-specific.

- [ ] **Step 3: Implement minimal provider-aware form changes**

Update `apps/web/src/components/build-profile-form.tsx` to:
- add provider state and provider selector UI
- maintain provider-specific context (`stateRoot` for OpenClaw, `workspaceRoot` for Codex)
- use unified `resolveAgents(...)` and `provisionAgent(...)`
- clear provider-specific errors, resolved agents, and selected agent on provider switch
- submit the provider-aware runtime payload

If you introduced `apps/web/src/lib/provider-form-state.ts`, keep it small and pure, and route provider-switch resets through it.

- [ ] **Step 4: Run form test to verify it passes**

Run: `pnpm exec vitest run apps/web/src/components/build-profile-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add apps/web/src/components/build-profile-form.tsx apps/web/src/components/build-profile-form.test.tsx
git commit
```

Use a Lore-format commit message if checkpointing.

### Task 3: Add unified `/agents/*` API routes with OpenClaw shims

**Files:**
- Create: `apps/api/src/routes/agents.ts`
- Modify: `apps/api/src/routes/openclaw.ts`
- Modify: `apps/api/src/routes/openclaw.test.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/routes/openclaw.test.ts`

- [ ] **Step 1: Write failing API tests for unified resolve/provision behavior**

Extend `apps/api/src/routes/openclaw.test.ts` or split shared coverage so tests assert:
- `POST /agents/resolve` returns a shared resolved workspace for OpenClaw
- `POST /agents/provision` returns `{ agent }`
- legacy `/openclaw/resolve` and `/openclaw/provision` still behave the same

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run apps/api/src/routes/openclaw.test.ts`
Expected: FAIL because `/agents/*` routes do not exist.

- [ ] **Step 3: Implement unified agent route layer**

Create `apps/api/src/routes/agents.ts` with provider-dispatched handlers.
For this task, wire only OpenClaw through the shared interface first.
Update `apps/api/src/app.ts` to register the new routes.
Keep `apps/api/src/routes/openclaw.ts` for serving-bundle endpoints and legacy compatibility wrappers.

- [ ] **Step 4: Run agent route tests to verify they pass**

Run: `pnpm exec vitest run apps/api/src/routes/openclaw.test.ts`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add apps/api/src/routes/agents.ts apps/api/src/routes/openclaw.ts apps/api/src/routes/openclaw.test.ts apps/api/src/app.ts
git commit
```

Use a Lore-format commit message if checkpointing.

### Task 4: Implement Codex sandbox preset storage and discovery

**Files:**
- Create: `packages/sandbox/src/codex/types.ts`
- Create: `packages/sandbox/src/codex/agent-id.ts`
- Create: `packages/sandbox/src/codex/workspace-store.ts`
- Create: `packages/sandbox/src/codex/workspace-resolver.ts`
- Create: `packages/sandbox/src/codex/agent-provisioner.ts`
- Modify: `packages/sandbox/src/index.ts`
- Test: `packages/sandbox/src/codex/agent-id.test.ts`
- Test: `packages/sandbox/src/codex/workspace-store.test.ts`
- Test: `packages/sandbox/src/codex/workspace-resolver.test.ts`
- Test: `packages/sandbox/src/codex/agent-provisioner.test.ts`

- [ ] **Step 1: Write failing Codex adapter tests**

Create tests that lock:
- `agentId` normalization/validation rules
- workspace-local persistence in `.trial-arena/codex-agents.json`
- resolve returns persisted agents
- provision rejects duplicates in the same workspace
- malformed `.trial-arena/codex-agents.json` surfaces a discovery/config error
- newly provisioned records include runnable persisted fields such as `createdAt` and default `instructions`

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/sandbox/src/codex/agent-id.test.ts packages/sandbox/src/codex/workspace-store.test.ts packages/sandbox/src/codex/workspace-resolver.test.ts packages/sandbox/src/codex/agent-provisioner.test.ts`
Expected: FAIL because the files do not exist yet.

- [ ] **Step 3: Implement minimal Codex preset adapter**

Create focused modules:
- `agent-id.ts` for deterministic normalization/validation
- `workspace-store.ts` for JSON file persistence
- `workspace-resolver.ts` for listing Codex agents from persisted state
- `agent-provisioner.ts` for writing new presets
- `types.ts` for Codex-specific persisted and runtime contracts
- export new functions/types from `packages/sandbox/src/index.ts`

- [ ] **Step 4: Run Codex preset tests to verify they pass**

Run: `pnpm exec vitest run packages/sandbox/src/codex/agent-id.test.ts packages/sandbox/src/codex/workspace-store.test.ts packages/sandbox/src/codex/workspace-resolver.test.ts packages/sandbox/src/codex/agent-provisioner.test.ts`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add packages/sandbox/src/codex packages/sandbox/src/index.ts
git commit
```

Use a Lore-format commit message if checkpointing.

### Task 5: Implement Codex runner and provider-aware `/runs` dispatch

**Files:**
- Create: `packages/sandbox/src/codex/runner.ts`
- Create: `packages/sandbox/src/codex/runner.test.ts`
- Modify: `packages/sandbox/src/index.ts`
- Modify: `apps/api/src/routes/runs.ts`
- Modify: `apps/api/src/routes/runs.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `packages/orchestrator/src/start-run.ts`
- Modify: `packages/orchestrator/src/start-run.test.ts`

- [ ] **Step 1: Write failing runner and dispatch tests**

Add tests that lock:
- Codex runner shells out through the local `codex exec` contract using persisted preset instructions
- `/runs` accepts `kind: "provider-agent", provider: "codex"`
- `startRun(...)` dispatches to Codex runner when provider is `codex`
- legacy `kind: "openclaw"` and `agentName` request shapes still normalize correctly
- a non-zero `codex exec` result can still return `{ events, replay }` with exactly one terminal `run.completed`
- only unrecoverable setup/infrastructure failures reject

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/sandbox/src/codex/runner.test.ts packages/orchestrator/src/start-run.test.ts apps/api/src/routes/runs.test.ts`
Expected: FAIL because Codex runner/dispatch does not exist yet.

- [ ] **Step 3: Implement minimal provider-agent execution**

Update `apps/api/src/routes/runs.ts` to:
- normalize legacy request shapes to the shared provider-agent model
- attach provider-specific execution dependencies (`gateway` for OpenClaw, `runner` for Codex)

Update `apps/api/src/app.ts` to accept injectable Codex execution dependencies for tests, so `/runs` tests can use doubles instead of the real local `codex` CLI.

Update `packages/orchestrator/src/start-run.ts` to:
- accept `provider-agent` orchestrator runtime
- dispatch OpenClaw vs Codex provider runtimes

Create `packages/sandbox/src/codex/runner.ts` to:
- load the persisted Codex agent preset
- run `codex exec --cd <workspaceRoot> --skip-git-repo-check --output-last-message <tmpfile> <prompt>`
- synthesize compatible `RunEvent[]` and replay output

- [ ] **Step 4: Run runner and dispatch tests to verify they pass**

Run: `pnpm exec vitest run packages/sandbox/src/codex/runner.test.ts packages/orchestrator/src/start-run.test.ts apps/api/src/routes/runs.test.ts`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add packages/sandbox/src/codex/runner.ts packages/sandbox/src/codex/runner.test.ts packages/sandbox/src/index.ts apps/api/src/routes/runs.ts apps/api/src/routes/runs.test.ts apps/api/src/app.ts packages/orchestrator/src/start-run.ts packages/orchestrator/src/start-run.test.ts
git commit
```

Use a Lore-format commit message if checkpointing.

### Task 6: Wire Codex into unified agent API and finish regression coverage

**Files:**
- Modify: `apps/api/src/routes/agents.ts`
- Modify: `apps/api/src/routes/openclaw.test.ts` (or split out shared agent route test if needed)
- Modify: `apps/api/src/app.ts`
- Modify: `README.md`
- Test: `apps/api/src/routes/openclaw.test.ts`
- Test: targeted integration suite across web/api/orchestrator/sandbox

- [ ] **Step 1: Write failing unified-agent tests for Codex**

Extend API tests to assert:
- `POST /agents/resolve` works for `provider: "codex"`
- `POST /agents/provision` works for `provider: "codex"`
- returned bodies use the shared response contract

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run apps/api/src/routes/openclaw.test.ts`
Expected: FAIL because unified Codex provider dispatch is not wired yet.

- [ ] **Step 3: Implement Codex route wiring and docs**

Update `apps/api/src/routes/agents.ts` to dispatch both OpenClaw and Codex.
Update `apps/api/src/app.ts` to accept injectable Codex resolve/provision factories so route tests can run entirely with doubles.
Update `README.md` with the new provider-aware flow and minimal Codex testing instructions.

- [ ] **Step 4: Run targeted regression suite to verify it passes**

Run: `pnpm exec vitest run apps/web/src/components/build-profile-form.test.tsx apps/api/src/routes/openclaw.test.ts apps/api/src/routes/runs.test.ts packages/orchestrator/src/start-run.test.ts packages/sandbox/src/codex/agent-id.test.ts packages/sandbox/src/codex/workspace-store.test.ts packages/sandbox/src/codex/workspace-resolver.test.ts packages/sandbox/src/codex/agent-provisioner.test.ts packages/sandbox/src/codex/runner.test.ts`
Expected: PASS

- [ ] **Step 5: Optional Lore commit checkpoint**

```bash
git add apps/api/src/routes/agents.ts apps/api/src/routes/openclaw.test.ts apps/api/src/app.ts README.md
git commit
```

Use a Lore-format commit message if checkpointing.

### Task 7: Final verification

**Files:**
- Modify only if regressions require fixes in files above

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 2: Run package typechecks**

Run: `pnpm exec tsc --noEmit -p apps/web/tsconfig.json && pnpm exec tsc --noEmit -p apps/api/tsconfig.json && pnpm exec tsc --noEmit -p packages/orchestrator/tsconfig.json && pnpm exec tsc --noEmit -p packages/sandbox/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Run diff hygiene checks**

Run: `git diff --check`
Expected: PASS

- [ ] **Step 4: Final Lore commit checkpoint**

```bash
git add README.md apps packages
git commit
```

Use a full Lore-format commit message that records the intent, constraints, confidence, scope risk, and test evidence.
