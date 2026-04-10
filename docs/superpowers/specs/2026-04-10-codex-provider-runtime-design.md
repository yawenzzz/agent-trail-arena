# Codex Provider Runtime Design

## Summary

Extend Trial Arena from an OpenClaw-specific runtime into a provider-aware runtime system that supports both OpenClaw and Codex agents through one unified model.

The goal is not to bolt on a second one-off branch, but to refactor the current agent-management and run-execution path so that provider-specific logic is isolated behind adapters while the web app, API, and orchestrator operate on shared provider/runtime abstractions.

## Goals

- Add support for adding, selecting, and running Codex agents.
- Preserve existing OpenClaw behavior and compatibility.
- Unify runtime modeling so OpenClaw and Codex share the same top-level flow.
- Keep provider-specific logic contained in sandbox adapters.
- Make future providers easier to add without reworking UI and API shape again.

## Non-Goals

- Do not redesign the existing judge, analysis, grading, or replay pipelines.
- Do not require Codex to replicate every OpenClaw-specific session/gateway behavior in v1.
- Do not remove existing OpenClaw routes immediately if compatibility shims are lower-risk.
- Do not add new dependencies unless implementation proves one is necessary.

## Current Problem

The current system hardcodes OpenClaw concepts across multiple layers:

- web types use `OpenClawAgentDescriptor` and `OpenClawRuntimeTarget`
- the build form only supports OpenClaw workspace resolution and provisioning
- the API exposes OpenClaw-specific agent management routes
- `/runs` only accepts `scripted` or `openclaw`
- the orchestrator only dispatches provider-backed runs to OpenClaw
- the sandbox only implements OpenClaw runtime integration

As a result, adding Codex cleanly requires introducing a provider-aware abstraction rather than duplicating the OpenClaw path.

## Design Principles

1. **Provider-first, not OpenClaw-first**
   Shared layers should depend on `provider` and `runtime kind`, not on OpenClaw-specific names.
2. **Adapters at the boundary**
   OpenClaw and Codex differences belong in sandbox adapters and API dispatch helpers, not in web UI state or orchestrator business logic.
3. **Compatibility before cleanup**
   Existing OpenClaw behavior must keep working while the shared abstractions are introduced.
4. **Minimal Codex v1 loop**
   Codex support must be good enough to resolve/provision/select an agent and run a trial that produces compatible run events, without trying to match every OpenClaw-specific internal detail.

## Core Shared Model

### Agent provider

```ts
export type AgentProvider = "openclaw" | "codex";
```

### Shared agent descriptor

```ts
type AgentDescriptor =
  | {
      readonly provider: "openclaw";
      readonly agentId: string;
      readonly agentName: string;
      readonly workspaceRoot: string;
      readonly definitionPath: string;
      readonly metadata?: Record<string, unknown>;
    }
  | {
      readonly provider: "codex";
      readonly agentId: string;
      readonly agentName: string;
      readonly workspaceRoot: string;
      readonly definitionPath?: string;
      readonly metadata?: Record<string, unknown>;
    };
```

### Shared resolved context

```ts
type ResolvedAgentWorkspace =
  | {
      readonly provider: "openclaw";
      readonly stateRoot: string;
      readonly configPath: string;
      readonly agents: readonly Extract<AgentDescriptor, { provider: "openclaw" }>[];
    }
  | {
      readonly provider: "codex";
      readonly workspaceRoot: string;
      readonly agents: readonly Extract<AgentDescriptor, { provider: "codex" }>[];
    };
```

### Unified runtime target

These shared types must stay **discriminated**, not loosely optional, so each layer can safely narrow by `provider` without guessing which fields exist.

The runtime model must be separated across three stages:

```ts
type RunRequestRuntime =
  | { readonly kind: "scripted"; readonly agentName: ScriptedAgentName }
  | {
      readonly kind: "provider-agent";
      readonly provider: AgentProvider;
      readonly agentId: string;
      readonly workspaceRoot: string;
    };

type NormalizedApiRuntime =
  | { readonly kind: "scripted"; readonly agentName: ScriptedAgentName }
  | {
      readonly kind: "provider-agent";
      readonly provider: AgentProvider;
      readonly agentId: string;
      readonly workspaceRoot: string;
    };

type OrchestratorRuntime =
  | { readonly kind: "scripted"; readonly agentName: ScriptedAgentName }
  | {
      readonly kind: "provider-agent";
      readonly provider: "openclaw";
      readonly agentId: string;
      readonly workspaceRoot: string;
      readonly gateway: OpenClawGateway;
    }
  | {
      readonly kind: "provider-agent";
      readonly provider: "codex";
      readonly agentId: string;
      readonly workspaceRoot: string;
      readonly runner: CodexRunner;
    };
```

- `RunRequestRuntime` is the inbound `/runs` payload shape.
- `NormalizedApiRuntime` is the compatibility-normalized API representation.
- `OrchestratorRuntime` is the fully wired execution object passed into the orchestrator.

## Layer Boundaries

### Web (`apps/web`)
The web layer owns provider selection, form state, and displaying provider-specific inputs. It should not know provider-specific CLI/gateway details.

Responsibilities:
- let the user choose `openclaw` vs `codex`
- collect provider-specific context input
- resolve/provision/select agents through a unified API client
- submit a unified runtime payload to `/runs`

### API (`apps/api`)
The API layer owns request validation, provider dispatch, and compatibility shims.

Responsibilities:
- expose provider-aware agent routes
- keep `/runs` as one unified run entrypoint
- map provider requests to sandbox adapters
- keep existing OpenClaw routes working during migration when low-risk

The OpenClaw serving-bundle routes under `/openclaw/serving-bundle/*` remain **OpenClaw-only** in this phase. They are operational control surfaces for the existing OpenClaw integration, not part of the new shared provider abstraction.

### Orchestrator (`packages/orchestrator`)
The orchestrator owns run dispatch and downstream evaluation flow.

Responsibilities:
- accept a unified runtime target
- dispatch to the proper runner by provider
- keep judge/analyze/finalize unchanged once compatible events are returned

### Sandbox (`packages/sandbox`)
The sandbox layer owns provider-specific runtime integration.

Responsibilities:
- resolve provider agents
- provision provider agents
- run provider-backed trials
- return compatible event/replay output

Provider-specific runtime dependencies should be created outside the orchestrator. The API route layer should assemble provider runtime inputs via provider-specific factories/adapters, then pass a fully-resolved shared runtime target into the orchestrator.

## API Design

### New unified agent routes

#### `POST /agents/resolve`
Resolves provider-specific workspace/context and returns a shared `ResolvedAgentWorkspace`.

Request body:

```ts
type ResolveAgentsRequest =
  | {
      readonly provider: "openclaw";
      readonly stateRoot?: string;
      readonly configPath?: string;
    }
  | {
      readonly provider: "codex";
      readonly workspaceRoot: string;
    };
```

Response body:

```ts
type ResolveAgentsResponse = ResolvedAgentWorkspace;
```

Examples:

```json
{
  "provider": "openclaw",
  "stateRoot": "/tmp/openclaw-state"
}
```

```json
{
  "provider": "codex",
  "workspaceRoot": "/tmp/project"
}
```

#### `POST /agents/provision`
Creates or provisions an agent for a provider and returns a shared `AgentDescriptor`.

Request body:

```ts
type ProvisionAgentRequest =
  | {
      readonly provider: "openclaw";
      readonly stateRoot?: string;
      readonly configPath?: string;
      readonly agentName: string;
    }
  | {
      readonly provider: "codex";
      readonly workspaceRoot: string;
      readonly agentName: string;
    };
```

Response body:

```ts
interface ProvisionAgentResponse {
  readonly agent: AgentDescriptor;
}
```

Example:

```json
{
  "provider": "codex",
  "workspaceRoot": "/tmp/project",
  "agentName": "trial-agent"
}
```

### Existing OpenClaw compatibility routes

Keep these routes temporarily as shims:
- `POST /openclaw/resolve`
- `POST /openclaw/provision`

They can internally call the same shared provider-aware implementation with `provider: "openclaw"`.

Compatibility wrappers should preserve current legacy response shapes:
- `/openclaw/resolve` returns the raw resolved workspace body
- `/openclaw/provision` returns `{ agent }`

### `/runs` migration compatibility

This migration should be **temporarily backward-compatible**.

The API should accept:
- legacy scripted input via `agentName`
- legacy OpenClaw runtime input via `kind: "openclaw"`
- new provider-aware runtime input via `kind: "provider-agent"`

The route should normalize all accepted request shapes into the new shared runtime model before calling the orchestrator. Frontend code should move to the new shape immediately, while backend compatibility remains in place during the migration window.

### Unified `/runs`
Keep `POST /runs`, but update the payload so provider-backed execution uses the shared runtime target:

```json
{
  "runtime": {
    "kind": "provider-agent",
    "provider": "codex",
    "agentId": "trial-agent",
    "workspaceRoot": "/tmp/project"
  }
}
```

## Frontend Interaction Design

### Build setup flow
The user flow becomes:

1. choose provider (`OpenClaw` or `Codex`)
2. enter provider-specific context
3. resolve available agents
4. create agent if needed
5. select agent
6. start trial

### Provider-specific inputs

#### OpenClaw
- state root
- resolve local agents
- create agent if missing

#### Codex
- workspace root
- resolve Codex agents
- create agent if missing

The interaction shape remains the same; only the provider-specific input fields differ.

### Frontend state
Refactor current OpenClaw-specific form state into provider-aware state:

- `provider`
- `providerContext`
  - OpenClaw: `stateRoot`, `configPath`
  - Codex: `workspaceRoot`
- `agents`
- `selectedAgentId`
- `createAgentName`

### Provider switch acceptance criteria

When the user switches provider in the build UI, the form must:
- clear incompatible provider context fields
- clear previously resolved agents
- clear the selected agent id
- clear provider-specific workspace/provision errors
- preserve only provider-agnostic inputs such as build allocation and agent version

This avoids leaking OpenClaw-specific state into Codex mode and vice versa.

## Runtime Adapter Design

### OpenClaw adapter
Retain the current OpenClaw modules under `packages/sandbox/src/openclaw/*` and adapt their exported types to the shared provider model.

### Codex adapter
Add a new parallel adapter family under `packages/sandbox/src/codex/*`:

- `workspace-resolver.ts`
- `agent-provisioner.ts`
- `runner.ts`
- optional `client.ts` if Codex-specific command/client logic should be isolated

Each provider implements the same conceptual responsibilities:
- resolve agents
- provision agents
- run a scenario

### Codex v1 identity and discovery contract

Codex v1 needs an explicit identity contract so the shared abstractions are testable:

- `workspaceRoot` is the required Codex context root.
- `agentId` is the stable identifier used by Trial Arena to refer to a Codex agent inside that workspace.
- `agentName` is the user-facing label shown in the UI; by default it may match `agentId`.
- resolve must return the current set of Codex agents discoverable from the workspace.
- provision must create a Codex agent so that a later resolve in the same workspace returns it again.
- `agentId` is derived from `agentName` using the same slugging/validation rules enforced by the adapter; invalid names must be rejected during provision.
- `agentId` uniqueness is scoped to a single `workspaceRoot`.
- provider-managed Codex agent metadata is persisted under a deterministic Trial Arena-managed file inside the workspace so later resolves are repeatable.

### Codex `agentId` normalization and validation

Codex `agentId` must be derived deterministically from `agentName` using this rule set:

1. trim leading/trailing whitespace
2. lowercase the result
3. replace any run of non-alphanumeric characters with a single `-`
4. collapse repeated `-`
5. strip leading/trailing `-`
6. require the final id to match:

```regex
^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$
```

7. maximum length: 64 characters

Provision fails when:
- normalization yields an empty id
- the normalized id violates the regex or length rule
- the normalized id already exists in the same `workspaceRoot`

Collision handling rule:
- collisions are rejected; the system does not silently append suffixes in v1
- the user must choose a different `agentName`

### Codex v1 persistence contract

Codex v1 should use a deterministic workspace-local metadata file managed by Trial Arena, for example:

```text
<workspaceRoot>/.trial-arena/codex-agents.json
```

That file is the canonical source for Codex resolve/provision in v1.

Required behavior:
- provision creates the file/directory if missing
- provision appends a new Codex agent record if the `agentId` is unique
- resolve reads this file and returns the stored agents
- duplicate `agentId` in the same workspace is rejected
- malformed persisted data yields a user-facing configuration/discovery error

This makes Codex discovery deterministic without forcing the rest of the system to know Codex-specific storage details.

Persisted Codex agent records should minimally contain:

```ts
interface PersistedCodexAgentRecord {
  readonly agentId: string;
  readonly agentName: string;
  readonly workspaceRoot: string;
  readonly createdAt: string;
  readonly instructions: string;
  readonly model?: string;
  readonly profile?: string;
  readonly sandbox?: "read-only" | "workspace-write" | "danger-full-access";
}
```

In v1, a “Codex agent” is a **Trial Arena-managed Codex execution preset**, not a native externally managed agent object. The persisted record is the source of truth for how Trial Arena later resolves and runs that agent.

## Orchestrator Dispatch

`start-run.ts` should treat provider-backed runs as a shared runtime kind and then branch by provider.

Dispatch shape:
- `scripted` -> existing scripted runner
- `provider-agent/openclaw` -> `runScenarioWithOpenClawAgent`
- `provider-agent/codex` -> `runScenarioWithCodexAgent`

This keeps `/runs` unified while localizing provider-specific logic to the dispatch edge.

### Provider runtime wiring

The orchestrator should not construct provider-specific clients itself.

Instead:
- `apps/api/src/routes/runs.ts` normalizes the request body into the shared runtime shape
- API-level provider factories/adapters attach provider-specific execution dependencies
- the orchestrator receives a discriminated runtime object that is already fully wired for execution

This replaces the current OpenClaw-only inline runtime wiring in `apps/api/src/routes/runs.ts`.

Concretely:
- OpenClaw wiring attaches `gateway: OpenClawGateway`
- Codex wiring attaches `runner: CodexRunner`
- the orchestrator never constructs those provider-specific dependencies itself

### Codex runner contract

`CodexRunner` must be a function-shaped dependency that is fully executable by the time it reaches the orchestrator:

```ts
interface CodexRunnerInput {
  readonly runId: string;
  readonly scenario: ScenarioDefinition;
  readonly agentId: string;
  readonly workspaceRoot: string;
}

interface CodexRunnerOutput {
  readonly events: readonly RunEvent[];
  readonly replay: ReplayLog;
}

type CodexRunner = (
  input: CodexRunnerInput
) => Promise<CodexRunnerOutput>;
```

Contract requirements:
- success resolves to `{ events, replay }`
- failure paths still resolve to `{ events, replay }` when the runner can produce a valid terminal errored run
- only unrecoverable infrastructure/setup failures reject the promise
- returned `events` must satisfy the event compatibility guarantees defined below

This keeps the Codex runner boundary aligned with the existing provider-runner shape used by the rest of the system.

### Real Codex execution contract

Codex v1 execution must be based on the local Codex CLI that is available in this environment:

- `codex exec`
- `--cd <workspaceRoot>`
- `--skip-git-repo-check`
- `--output-last-message <file>`
- optional provider-managed flags such as `--model` or `--profile`

The Codex adapter should not guess an external hidden Codex runtime. It must execute the locally installed CLI directly.

#### Runner launch contract

For a provider-backed Codex run:

1. load the persisted `PersistedCodexAgentRecord` for `workspaceRoot + agentId`
2. build the final Codex prompt from:
   - the persisted `instructions`
   - the selected scenario goal/constraints
   - the Trial Arena run id and any execution framing needed by the adapter
3. execute:

```text
codex exec --cd <workspaceRoot> --skip-git-repo-check --output-last-message <tmpfile> <prompt>
```

4. if the persisted record contains `model`, pass `--model <model>`
5. if the persisted record contains `profile`, pass `--profile <profile>`
6. if the persisted record contains `sandbox`, pass `--sandbox <sandbox>`
7. read the final assistant text from `<tmpfile>`
8. synthesize Trial Arena-compatible `events` and `replay`

#### Provision contract for Codex agents

Provisioning a Codex agent must create a persisted preset record with:
- normalized `agentId`
- `agentName`
- `workspaceRoot`
- default `instructions`
- optional execution defaults (`model`, `profile`, `sandbox`) when present

If the caller only provides an `agentName`, the adapter creates the record with a safe default instruction template suitable for Trial Arena scenarios. Later UI/API iterations may expose richer Codex-agent configuration, but v1 must be runnable without extra manual fields.

#### Minimum synthesized event contract

Because Codex CLI does not expose the same gateway/session surface as OpenClaw, the Codex adapter may synthesize a minimal event stream from CLI execution results:
- `run.started`
- zero or more `agent.summary` events derived from final or intermediate Codex output
- exactly one `run.completed`

When the CLI exits non-zero but the adapter can still form a valid errored run summary, it should return a terminal errored run rather than rejecting.

Only unrecoverable adapter failures should reject, for example:
- missing `codex` binary
- missing persisted agent record
- unreadable workspace
- malformed persisted Codex metadata

## Codex v1 Behavior Boundary

Codex v1 only needs a minimal but real execution loop:

- resolve/provision/select a Codex agent
- run one trial from `workspaceRoot + agentId`
- emit compatible `RunEvent[]`
- produce replay output that the rest of Trial Arena can consume
- finish with `run.completed`

Codex v1 does **not** need to perfectly reproduce all OpenClaw-specific session/gateway semantics.

### Event and replay compatibility guarantees

Codex runner output must satisfy these minimum guarantees:
- emit `run.started` first
- emit exactly one terminal `run.completed`
- on failure paths, still emit a terminal `run.completed` with `failed` or `errored` outcome
- produce replay data consumable by existing replay, analysis, grading, and finalization flows
- preserve enough event structure for current judge/analyze pipelines to operate without provider-specific forks

## Error Handling

Provider adapters should return provider-specific failures, but API routes should translate them into clear user-facing errors.

Expected categories:
- invalid provider context input
- missing workspace/state root
- malformed provider config or discovery output
- duplicate agent name/id
- provision failure
- runtime execution failure

The API should preserve the current pattern of mapping user-correctable input/config issues to 400-level responses and runtime/provider failures to execution errors.

## Testing Strategy

### Unit and component tests

#### Web
Update `build-profile-form.test.tsx` to cover:
- provider switching
- OpenClaw vs Codex input panels
- unified runtime payload creation

#### API
Add or update tests for:
- unified `POST /agents/resolve`
- unified `POST /agents/provision`
- compatibility behavior for existing OpenClaw routes
- `/runs` with `provider-agent/openclaw`
- `/runs` with `provider-agent/codex`

#### Orchestrator
Update `start-run.test.ts` to cover:
- dispatch to OpenClaw runner
- dispatch to Codex runner
- rejection of unsupported provider input

#### Sandbox
Add Codex adapter tests:
- `codex/workspace-resolver.test.ts`
- `codex/agent-provisioner.test.ts`
- `codex/runner.test.ts`

### Regression priorities

1. Existing OpenClaw resolution/provision/run flow must keep passing.
2. New Codex flow must support the minimal end-to-end trial loop.
3. Shared runtime payload creation must stay consistent across web, API, and orchestrator.
4. Provider switching in the UI must clear incompatible state correctly.
5. Legacy `/runs` request shapes must normalize correctly during the migration window.

## Incremental Implementation Order

1. Introduce shared provider/runtime types.
2. Update web types and API client to use shared types.
3. Add unified `/agents/*` routes.
4. Update `/runs` payload parsing and orchestrator dispatch.
5. Implement Codex sandbox adapters.
6. Add regression and new-provider tests.
7. Keep or thin compatibility shims after the unified flow is green.

## Risks

- Existing OpenClaw naming is spread broadly enough that partial renaming may create temporary duplication.
- Codex adapter behavior may differ from OpenClaw enough that event normalization needs careful tests.
- Leaving both old and new routes during migration creates short-term surface duplication, but that risk is lower than a flag-day cutover.

## Recommendation

Adopt the unified provider/runtime abstraction now and implement Codex as the second provider behind shared interfaces.

This gives the cleanest long-term shape while keeping the rollout incremental and low-risk for existing OpenClaw behavior.
