# OpenClaw Gateway Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scripted-only runtime path with a first OpenClaw-backed trial flow that discovers local agents from a user-provided workspace, provisions a minimal agent when none exists, executes one temporary Gateway session per run, and preserves Trial Arena timeline/replay/judge behavior.

**Architecture:** Add a focused OpenClaw integration slice behind `packages/sandbox`: a workspace resolver and agent provisioner for local `.openclaw` state, plus a gateway-backed runner that maps session traffic into `RunEvent`. Then widen orchestrator and API inputs from a scripted agent name to a runtime target union, and update the `/builds` screen so users can resolve agents, create one if needed, and launch a run against the chosen agent.

**Tech Stack:** TypeScript, Node.js child processes, WebSocket client (`ws`), Fastify, Next.js, React, Vitest

---

## File Structure

### Backend runtime files

- Create: `packages/sandbox/src/openclaw/types.ts`
  Defines `OpenClawAgentDescriptor`, gateway config, runtime target input, and raw event snapshot types used by the OpenClaw integration.
- Create: `packages/sandbox/src/openclaw/workspace-resolver.ts`
  Resolves a user-provided workspace root, locates `.openclaw`, and returns stable agent descriptors.
- Create: `packages/sandbox/src/openclaw/agent-provisioner.ts`
  Validates a requested agent name, constructs the minimal `openclaw agents add` invocation, and returns the new descriptor after refresh.
- Create: `packages/sandbox/src/openclaw/command-runner.ts`
  Wraps `node:child_process` execution for `openclaw agents add` so tests can inject a fake runner and API routes do not shell out inline.
- Create: `packages/sandbox/src/openclaw/gateway-client.ts`
  Owns low-level WebSocket connection, connect/auth bootstrap, request/response correlation, session creation, subscription, and closure.
- Create: `packages/sandbox/src/openclaw/event-mapper.ts`
  Maps raw Gateway session events into the existing `RunEvent` union plus terminal errored completions.
- Create: `packages/sandbox/src/openclaw/runner.ts`
  Coordinates one run: create session, subscribe, emit mapped events, close session on all terminal paths, and build replay snapshots.
- Create: `packages/sandbox/src/openclaw/workspace-resolver.test.ts`
  Covers valid workspace resolution, missing `.openclaw`, malformed definitions, and stable descriptor generation.
- Create: `packages/sandbox/src/openclaw/agent-provisioner.test.ts`
  Covers name validation, duplicate rejection, command construction, and refresh behavior with a fake command runner.
- Create: `packages/sandbox/src/openclaw/event-mapper.test.ts`
  Covers representative message/tool/error mapping and terminal errored fallback behavior.
- Create: `packages/sandbox/src/openclaw/runner.test.ts`
  Covers session lifecycle, event ordering, replay retention, and failure cleanup with a mocked gateway client.
- Modify: `packages/sandbox/src/index.ts`
  Exports the new OpenClaw resolver, provisioner, runner, and types without breaking the existing scripted runner.
- Modify: `packages/sandbox/package.json`
  Adds the runtime dependency for a predictable Node WebSocket client.

### Orchestrator and API files

- Create: `apps/api/src/routes/openclaw.ts`
  Registers resolve/provision endpoints for workspace discovery and minimal agent creation.
- Create: `apps/api/src/routes/openclaw.test.ts`
  Covers workspace resolution, no-agent responses, provisioning success, validation failures, and gateway-independent request handling.
- Create: `apps/api/src/config/openclaw.ts`
  Reads `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, and `OPENCLAW_GATEWAY_PASSWORD` once and exposes a typed config object.
- Modify: `packages/orchestrator/src/start-run.ts`
  Accepts a runtime target union, dispatches to scripted or OpenClaw runners, and preserves finalization behavior.
- Modify: `packages/orchestrator/src/start-run.test.ts`
  Adds OpenClaw-backed start-run coverage while retaining scripted-run assertions.
- Modify: `apps/api/src/routes/runs.ts`
  Accepts the runtime target payload, resolves the correct runner path, and preserves summary/stream/replay responses.
- Modify: `apps/api/src/routes/runs.test.ts`
  Adds request-shape coverage for OpenClaw runtime runs and unknown-run handling.
- Modify: `apps/api/src/app.ts`
  Injects OpenClaw config and registers the new route module.
- Modify: `apps/api/src/server.ts`
  Optionally logs the configured port and preserves the current entrypoint behavior.

### Web files

- Create: `apps/web/src/components/openclaw-workspace-panel.tsx`
  Collects the workspace root, loads agent descriptors, and surfaces resolve/provision errors.
- Create: `apps/web/src/components/openclaw-agent-picker.tsx`
  Renders the discovered agent list, empty-state CTA, and minimal create-agent input.
- Modify: `apps/web/src/components/build-profile-form.tsx`
  Integrates the OpenClaw workspace flow, blocks `Start trial` until a target agent exists, and submits the OpenClaw runtime payload.
- Modify: `apps/web/src/components/build-profile-form.test.tsx`
  Adds coverage for resolve/provision UI states and the final run payload.
- Modify: `apps/web/src/lib/api-client.ts`
  Adds typed resolve/provision calls and widens `createRun` to accept the new runtime target.
- Modify: `apps/web/src/lib/trial-types.ts`
  Adds the minimal client-side runtime/agent descriptor types needed by the form.

### Verification files

- Modify: `tests/e2e/trial-arena.spec.ts`
  Keep the deterministic scripted flow intact or mark it explicitly as scripted-only; do not add a real Gateway dependency to CI in this pass.

## Chunk 1: Backend OpenClaw Runtime Slice

### Task 1: Workspace discovery and minimal provisioning

**Files:**
- Create: `packages/sandbox/src/openclaw/types.ts`
- Create: `packages/sandbox/src/openclaw/workspace-resolver.ts`
- Create: `packages/sandbox/src/openclaw/agent-provisioner.ts`
- Create: `packages/sandbox/src/openclaw/command-runner.ts`
- Create: `packages/sandbox/src/openclaw/workspace-resolver.test.ts`
- Create: `packages/sandbox/src/openclaw/agent-provisioner.test.ts`
- Modify: `packages/sandbox/src/index.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from "vitest";

import { resolveOpenClawWorkspace } from "./workspace-resolver.js";

describe("resolveOpenClawWorkspace", () => {
  it("returns stable agent descriptors from a valid workspace", async () => {
    const result = await resolveOpenClawWorkspace({
      workspaceRoot: "/tmp/openclaw-workspace"
    });

    expect(result.agents[0]).toMatchObject({
      agentId: expect.any(String),
      agentName: "prod-agent",
      workspaceRoot: "/tmp/openclaw-workspace"
    });
  });
});
```

- [ ] **Step 2: Run resolver tests to verify they fail**

Run: `pnpm vitest run packages/sandbox/src/openclaw/workspace-resolver.test.ts`
Expected: FAIL because `workspace-resolver.ts` and its exports do not exist yet.

- [ ] **Step 3: Implement the resolver with a narrow filesystem contract**

```ts
export async function resolveOpenClawWorkspace(
  input: ResolveOpenClawWorkspaceInput
): Promise<ResolvedOpenClawWorkspace> {
  const openclawRoot = join(input.workspaceRoot, ".openclaw");
  const definitions = await readAgentDefinitions(openclawRoot);

  return {
    workspaceRoot: input.workspaceRoot,
    openclawRoot,
    agents: definitions.map((definition) => ({
      agentId: createAgentId(definition.path),
      agentName: definition.name,
      definitionPath: definition.path,
      workspaceRoot: input.workspaceRoot
    }))
  };
}
```

- [ ] **Step 4: Write the failing provisioner tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { createOpenClawAgent } from "./agent-provisioner.js";

describe("createOpenClawAgent", () => {
  it("rejects duplicate names before invoking the CLI", async () => {
    const runCommand = vi.fn();

    await expect(
      createOpenClawAgent({
        workspaceRoot: "/tmp/openclaw-workspace",
        agentName: "prod-agent",
        existingAgents: [{ agentId: "a1", agentName: "prod-agent", definitionPath: "x", workspaceRoot: "/tmp/openclaw-workspace" }],
        runCommand
      })
    ).rejects.toThrow("already exists");

    expect(runCommand).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run provisioner tests to verify they fail**

Run: `pnpm vitest run packages/sandbox/src/openclaw/agent-provisioner.test.ts`
Expected: FAIL because `agent-provisioner.ts` and `createOpenClawAgent` do not exist yet.

- [ ] **Step 6: Implement minimal provisioning with injected command execution**

```ts
export async function createOpenClawAgent(
  input: CreateOpenClawAgentInput
): Promise<OpenClawAgentDescriptor> {
  assertValidAgentName(input.agentName);
  assertUniqueAgentName(input.agentName, input.existingAgents);

  await input.runCommand([
    "openclaw",
    "agents",
    "add",
    "--workspace",
    input.workspaceRoot,
    "--name",
    input.agentName
  ]);

  const refreshed = await input.resolveWorkspace({ workspaceRoot: input.workspaceRoot });
  const created = refreshed.agents.find((agent) => agent.agentName === input.agentName);
  if (!created) {
    throw new Error(`Agent creation did not produce a definition for ${input.agentName}`);
  }
  return created;
}
```

- [ ] **Step 7: Re-run resolver and provisioner tests**

Run: `pnpm vitest run packages/sandbox/src/openclaw/workspace-resolver.test.ts packages/sandbox/src/openclaw/agent-provisioner.test.ts`
Expected: PASS with resolver and provisioning assertions green.

- [ ] **Step 8: Export the new units from the sandbox package**

```ts
export { resolveOpenClawWorkspace } from "./openclaw/workspace-resolver.js";
export { createOpenClawAgent } from "./openclaw/agent-provisioner.js";
export { executeOpenClawCommand } from "./openclaw/command-runner.js";
export type {
  OpenClawAgentDescriptor,
  ResolvedOpenClawWorkspace
} from "./openclaw/types.js";
```

- [ ] **Step 9: Commit**

```bash
git add packages/sandbox/src/index.ts \
  packages/sandbox/src/openclaw/types.ts \
  packages/sandbox/src/openclaw/workspace-resolver.ts \
  packages/sandbox/src/openclaw/workspace-resolver.test.ts \
  packages/sandbox/src/openclaw/agent-provisioner.ts \
  packages/sandbox/src/openclaw/command-runner.ts \
  packages/sandbox/src/openclaw/agent-provisioner.test.ts
git commit -m "feat: add openclaw workspace discovery"
```

### Task 2: Gateway client, event mapping, and session runner

**Files:**
- Create: `packages/sandbox/src/openclaw/gateway-client.ts`
- Create: `packages/sandbox/src/openclaw/event-mapper.ts`
- Create: `packages/sandbox/src/openclaw/runner.ts`
- Create: `packages/sandbox/src/openclaw/event-mapper.test.ts`
- Create: `packages/sandbox/src/openclaw/runner.test.ts`
- Modify: `packages/sandbox/src/index.ts`
- Modify: `packages/sandbox/package.json`

- [ ] **Step 1: Write the failing mapper and runner tests**

```ts
import { describe, expect, it } from "vitest";

import { mapGatewayEvent } from "./event-mapper.js";
import { runScenarioWithOpenClawAgent } from "./runner.js";

describe("mapGatewayEvent", () => {
  it("maps tool activity into tool.called events", () => {
    expect(
      mapGatewayEvent({
        type: "tool_call",
        tool_name: "bash",
        input: { command: "pwd" }
      })
    ).toEqual({
      type: "tool.called",
      toolName: "bash",
      input: { command: "pwd" }
    });
  });
});

describe("runScenarioWithOpenClawAgent", () => {
  it("closes the temporary session after a completed run", async () => {
    const gateway = createFakeGateway();
    const output = await runScenarioWithOpenClawAgent({
      gateway,
      runId: "run-0001",
      scenarioId: "scenario-1",
      scenarioType: "workflow",
      agentId: "agent-1"
    });

    expect(output.events.at(-1)?.type).toBe("run.completed");
    expect(output.replay.events).toEqual(output.events);
    expect(gateway.closeSession).toHaveBeenCalledWith("session-1");
  });
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm vitest run packages/sandbox/src/openclaw/event-mapper.test.ts packages/sandbox/src/openclaw/runner.test.ts`
Expected: FAIL because the mapper and runner files do not exist yet.

- [ ] **Step 3: Add the WebSocket dependency and the low-level gateway client**

```ts
export class OpenClawGatewayClient {
  async createSession(input: CreateSessionInput): Promise<{ sessionId: string }> {
    await this.connect();
    return this.request("session.create", input);
  }

  async *subscribeSession(sessionId: string): AsyncGenerator<GatewayEvent> {
    for await (const event of this.eventsFor(sessionId)) {
      yield event;
    }
  }

  async closeSession(sessionId: string) {
    await this.request("session.close", { sessionId });
  }
}
```

- [ ] **Step 4: Implement the event mapper with explicit errored fallbacks**

```ts
export function mapGatewayEvent(input: GatewayEvent): RunEvent[] {
  if (input.type === "assistant_message") {
    return [{ type: "agent.summary", text: input.text }];
  }

  if (input.type === "tool_call") {
    return [{ type: "tool.called", toolName: input.tool_name, input: input.input }];
  }

  if (input.type === "status") {
    return [{ type: "judge.update", summary: input.summary }];
  }

  return [{
    type: "judge.update",
    summary: `Unhandled OpenClaw event: ${input.type}`
  }];
}
```

- [ ] **Step 5: Implement the one-session runner**

```ts
export async function runScenarioWithOpenClawAgent(
  input: OpenClawRunnerInput
): Promise<RunnerOutput> {
  const events: RunEvent[] = [{
    type: "run.started",
    runId: input.runId,
    scenarioId: input.scenarioId
  }];

  const session = await input.gateway.createSession({ agentId: input.agentId });

  try {
    for await (const rawEvent of input.gateway.subscribeSession(session.sessionId)) {
      events.push(...mapGatewayEvent(rawEvent));
    }

    events.push({
      type: "run.completed",
      result: {
        scenarioId: input.scenarioId,
        scenarioType: input.scenarioType,
        outcome: "passed",
        summary: "OpenClaw session completed."
      }
    });
  } catch (error) {
    events.push({
      type: "judge.update",
      summary: error instanceof Error ? error.message : "OpenClaw session failed."
    });
    events.push({
      type: "run.completed",
      result: {
        scenarioId: input.scenarioId,
        scenarioType: input.scenarioType,
        outcome: "errored",
        summary: "OpenClaw session failed."
      }
    });
  } finally {
    await input.gateway.closeSession(session.sessionId);
  }

  return {
    events,
    replay: createReplayLog(input.runId, events)
  };
}
```

- [ ] **Step 6: Re-run the OpenClaw sandbox tests**

Run: `pnpm vitest run packages/sandbox/src/openclaw/event-mapper.test.ts packages/sandbox/src/openclaw/runner.test.ts`
Expected: PASS with green mapper and runner coverage.

- [ ] **Step 7: Run the full sandbox test slice**

Run: `pnpm vitest run packages/sandbox/src/runner.test.ts packages/sandbox/src/openclaw/*.test.ts`
Expected: PASS with both scripted and OpenClaw runner tests green.

- [ ] **Step 8: Commit**

```bash
git add packages/sandbox/package.json \
  packages/sandbox/src/index.ts \
  packages/sandbox/src/openclaw/gateway-client.ts \
  packages/sandbox/src/openclaw/event-mapper.ts \
  packages/sandbox/src/openclaw/event-mapper.test.ts \
  packages/sandbox/src/openclaw/runner.ts \
  packages/sandbox/src/openclaw/runner.test.ts
git commit -m "feat: add openclaw gateway runner"
```

### Task 3: Orchestrator and API runtime wiring

**Files:**
- Create: `apps/api/src/config/openclaw.ts`
- Create: `apps/api/src/routes/openclaw.ts`
- Create: `apps/api/src/routes/openclaw.test.ts`
- Modify: `packages/orchestrator/src/start-run.ts`
- Modify: `packages/orchestrator/src/start-run.test.ts`
- Modify: `apps/api/src/routes/runs.ts`
- Modify: `apps/api/src/routes/runs.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Write failing orchestrator and route tests for OpenClaw runtime inputs**

```ts
it("starts a run with an OpenClaw runtime target", async () => {
  const run = await startRun({
    store,
    profile,
    registry,
    runtime: {
      kind: "openclaw",
      workspaceRoot: "/tmp/openclaw-workspace",
      agentId: "agent-1"
    }
  });

  expect(run.runId).toBe("run-0001");
});
```

```ts
it("resolves local OpenClaw agents for a workspace", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/openclaw/resolve",
    payload: { workspaceRoot: "/tmp/openclaw-workspace" }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json().agents).toHaveLength(1);
});
```

- [ ] **Step 2: Run the failing orchestrator and API tests**

Run: `pnpm vitest run packages/orchestrator/src/start-run.test.ts apps/api/src/routes/openclaw.test.ts apps/api/src/routes/runs.test.ts`
Expected: FAIL because `runtime` is not supported and the OpenClaw routes do not exist yet.

- [ ] **Step 3: Add typed API config and OpenClaw route handlers**

```ts
export function readOpenClawConfig(): OpenClawConfig {
  return {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789",
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
    gatewayPassword: process.env.OPENCLAW_GATEWAY_PASSWORD
  };
}
```

```ts
app.post("/openclaw/resolve", async (request) => {
  const body = request.body as { workspaceRoot: string };
  return resolveOpenClawWorkspace({ workspaceRoot: body.workspaceRoot });
});
```

- [ ] **Step 4: Widen orchestrator and `/runs` to a runtime-target union**

```ts
type RunRuntimeTarget =
  | { kind: "scripted"; agentName: ScriptedAgentName }
  | { kind: "openclaw"; workspaceRoot: string; agentId: string };

if (input.runtime.kind === "scripted") {
  runnerOutput = await runScenarioWithScriptedAgent(...);
} else {
  runnerOutput = await runScenarioWithOpenClawAgent(...);
}
```

- [ ] **Step 5: Add the provisioning endpoint**

```ts
app.post("/openclaw/provision", async (request, reply) => {
  const body = request.body as { workspaceRoot: string; agentName: string };
  const workspace = await resolveOpenClawWorkspace({ workspaceRoot: body.workspaceRoot });
  const agent = await createOpenClawAgent({
    workspaceRoot: body.workspaceRoot,
    agentName: body.agentName,
    existingAgents: workspace.agents,
    resolveWorkspace: resolveOpenClawWorkspace,
    runCommand: executeOpenClawCommand
  });

  reply.code(201);
  return { agent };
});
```

- [ ] **Step 6: Re-run orchestrator and API tests**

Run: `pnpm vitest run packages/orchestrator/src/start-run.test.ts apps/api/src/routes/openclaw.test.ts apps/api/src/routes/runs.test.ts`
Expected: PASS with the new runtime target and OpenClaw route coverage green.

- [ ] **Step 7: Run API type-check**

Run: `pnpm exec tsc -p apps/api/tsconfig.json --noEmit && pnpm exec tsc -p packages/orchestrator/tsconfig.json --noEmit`
Expected: PASS with no new type errors.

- [ ] **Step 8: Commit**

```bash
git add packages/orchestrator/src/start-run.ts \
  packages/orchestrator/src/start-run.test.ts \
  apps/api/src/config/openclaw.ts \
  apps/api/src/routes/openclaw.ts \
  apps/api/src/routes/openclaw.test.ts \
  apps/api/src/routes/runs.ts \
  apps/api/src/routes/runs.test.ts \
  apps/api/src/app.ts \
  apps/api/src/server.ts
git commit -m "feat: wire openclaw runtime through api"
```

## Chunk 2: Build Flow And Verification

### Task 4: Build screen OpenClaw workspace flow

**Files:**
- Create: `apps/web/src/components/openclaw-workspace-panel.tsx`
- Create: `apps/web/src/components/openclaw-agent-picker.tsx`
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Modify: `apps/web/src/components/build-profile-form.test.tsx`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/trial-types.ts`

- [ ] **Step 1: Write failing UI tests for resolve, provision, and launch states**

```tsx
it("blocks Start trial until an OpenClaw agent is selected", () => {
  const markup = renderToStaticMarkup(<BuildProfileForm />);

  expect(markup).toContain("OpenClaw workspace");
  expect(markup).toContain("Load agents");
  expect(markup).toContain("disabled");
});
```

```tsx
it("creates an OpenClaw runtime payload from the selected agent", () => {
  const request = createRunRequest(allocation, "agent-v1", {
    workspaceRoot: "/tmp/openclaw-workspace",
    agentId: "agent-1"
  });

  expect(request.runtime).toEqual({
    kind: "openclaw",
    workspaceRoot: "/tmp/openclaw-workspace",
    agentId: "agent-1"
  });
});
```

- [ ] **Step 2: Run the failing web tests**

Run: `pnpm vitest run apps/web/src/components/build-profile-form.test.tsx`
Expected: FAIL because the form does not yet expose OpenClaw workspace and agent selection state.

- [ ] **Step 3: Add typed client helpers for resolve and provision**

```ts
export async function resolveOpenClawWorkspace(input: { workspaceRoot: string }) {
  const response = await fetch(`${API_BASE_URL}/openclaw/resolve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(`Failed to resolve workspace: ${response.status}`);
  return response.json();
}
```

- [ ] **Step 4: Split the OpenClaw UI into focused components**

```tsx
<OpenClawWorkspacePanel
  workspaceRoot={workspaceRoot}
  onWorkspaceRootChange={setWorkspaceRoot}
  onResolve={handleResolveWorkspace}
  error={workspaceError}
/>
<OpenClawAgentPicker
  agents={agents}
  selectedAgentId={selectedAgentId}
  onSelectAgent={setSelectedAgentId}
  onCreateAgent={handleProvisionAgent}
/>
```

- [ ] **Step 5: Submit runs with the selected OpenClaw target**

```ts
return {
  agentVersion,
  build: toDeclaredBuild(allocation),
  judgeConfigVersion: "judge-v1",
  seed: "seed-123",
  runtime: {
    kind: "openclaw",
    workspaceRoot,
    agentId: selectedAgentId
  }
};
```

- [ ] **Step 6: Re-run the web tests**

Run: `pnpm vitest run apps/web/src/components/build-profile-form.test.tsx apps/web/src/components/live-stage.test.tsx apps/web/src/lib/build-allocation.test.ts`
Expected: PASS with the new resolve/provision flow and existing UI tests still green.

- [ ] **Step 7: Run web type-check**

Run: `pnpm exec tsc -p apps/web/tsconfig.json --noEmit`
Expected: PASS with no client-side type regressions.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/openclaw-workspace-panel.tsx \
  apps/web/src/components/openclaw-agent-picker.tsx \
  apps/web/src/components/build-profile-form.tsx \
  apps/web/src/components/build-profile-form.test.tsx \
  apps/web/src/lib/api-client.ts \
  apps/web/src/lib/trial-types.ts
git commit -m "feat: add openclaw build flow"
```

### Task 5: End-to-end verification and production-facing smoke checks

**Files:**
- Modify: `tests/e2e/trial-arena.spec.ts`
- Modify: `docs/superpowers/specs/2026-03-20-openclaw-gateway-integration-design.md`

- [ ] **Step 1: Tighten the existing scripted E2E label so CI stays deterministic**

```ts
test("user can launch a scripted trial and open replay", async ({ page }) => {
  // existing deterministic flow
});
```

- [ ] **Step 2: Add a manual OpenClaw smoke checklist to the spec or adjacent docs**

```md
1. Start OpenClaw Gateway on `ws://127.0.0.1:18789`
2. Start API with `OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789`
3. Open `/builds`, resolve a workspace, select or create an agent
4. Launch a trial and verify `/arena/[runId]` shows mapped events
5. Open `/replay/[runId]` and verify stored event playback after the session closes
```

- [ ] **Step 3: Run the deterministic regression suite**

Run: `pnpm vitest run packages/sandbox/src/openclaw/*.test.ts packages/orchestrator/src/start-run.test.ts apps/api/src/routes/openclaw.test.ts apps/api/src/routes/runs.test.ts apps/web/src/components/build-profile-form.test.tsx`
Expected: PASS with all targeted OpenClaw and existing regression tests green.

- [ ] **Step 4: Run full type-check and web build**

Run: `pnpm exec tsc -p packages/orchestrator/tsconfig.json --noEmit && pnpm exec tsc -p apps/api/tsconfig.json --noEmit && pnpm exec tsc -p apps/web/tsconfig.json --noEmit && pnpm --filter @openclaw/web exec next build`
Expected: PASS with no type errors and a successful web production build.

- [ ] **Step 5: Run the scripted E2E**

Run: `pnpm test:e2e -- --grep "scripted trial"`
Expected: PASS without requiring a live OpenClaw Gateway.

- [ ] **Step 6: Perform one manual OpenClaw smoke run**

Run:
```bash
pnpm --filter @openclaw/api exec node --import tsx src/server.ts
OPENCLAW_API_BASE_URL=http://127.0.0.1:3001 pnpm --filter @openclaw/web exec next dev --hostname 127.0.0.1 --port 3000
```
Expected:
- workspace resolves from `/builds`
- existing agents appear or minimal provisioning succeeds
- one run creates one temporary session
- `/arena/[runId]` and `/replay/[runId]` still work after session closure

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/trial-arena.spec.ts \
  docs/superpowers/specs/2026-03-20-openclaw-gateway-integration-design.md
git commit -m "test: document and verify openclaw runtime flow"
```
