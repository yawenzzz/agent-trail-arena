# OpenClaw Gateway Integration Design

## Summary

Add a first real runtime integration for Trial Arena by connecting it to a local OpenClaw Gateway instance instead of the current deterministic scripted agent only flow.

The first version supports only OpenClaw and assumes:

- OpenClaw Gateway is running locally
- the user provides an OpenClaw working-directory root path
- Trial Arena resolves `.openclaw` under that path
- each trial run creates a fresh temporary OpenClaw session
- the temporary session is closed when the run completes

The integration must support two user states:

1. the user already has one or more OpenClaw agents defined locally
2. the user has no local agent definition yet, and Trial Arena needs to create one with a minimal template before running the test

The product goal is not just “fire a request at an agent.” The run must capture process events from the OpenClaw session so the existing arena timeline, replay, and judge pipeline remain meaningful.

## Goals

- Replace the scripted-agent-only runtime path with an OpenClaw-backed path for real trials.
- Reuse the current `orchestrator -> sandbox -> judge -> replay` flow instead of inventing a parallel runtime stack.
- Use exactly one temporary OpenClaw session per trial run.
- Support discovery of existing local OpenClaw agents.
- Support minimal agent creation when the user has not created one yet.
- Preserve replay and judge behavior by mapping OpenClaw session events into the current `RunEvent` model.

## Non-Goals

- Supporting multiple runtime platforms in this pass.
- Rebuilding Trial Arena into a full OpenClaw agent management UI.
- Exposing every raw OpenClaw event 1:1 in the frontend.
- Persisting OpenClaw sessions after trial completion.
- Replacing the deterministic scripted runner in tests.

## Runtime Strategy

The recommended approach is `Gateway Adapter + Session Bridge`.

Trial Arena should treat OpenClaw as the real runtime behind a sandbox adapter boundary, not as a direct API concern and not as a shell-wrapper hack.

The runtime path becomes:

`web -> api -> orchestrator -> sandbox/openclaw-gateway-adapter -> local OpenClaw Gateway`

This preserves the existing architecture:

- `api` remains a thin transport layer
- `orchestrator` remains responsible for run lifecycle
- `sandbox` becomes the place where runtime-specific execution lives
- `judge` and `replay` continue to consume the existing unified event model

The scripted runner remains in place for deterministic tests and fallback development paths.

## Architecture

### OpenClawWorkspaceResolver

Add a focused resolver for OpenClaw local workspace state.

Responsibilities:

- accept a user-provided OpenClaw working-directory root path
- locate `.openclaw` under that root
- discover available local agent definitions
- expose enough metadata for UI selection and provisioning

The resolver should not return only a bare list of names. It should return a stable selection payload such as:

- `agentId`: a stable local identifier derived from the definition source
- `agentName`: the user-facing OpenClaw agent name
- `definitionPath`: the local definition file path or equivalent source path
- `workspaceRoot`: the OpenClaw working-directory root used for resolution

The UI can display `agentName`, but `agentId` is the key used for selection and execution.

This unit should not speak gateway protocol. Its job is filesystem and local workspace discovery only.

### OpenClawGatewayAdapter

Add a runtime adapter inside `packages/sandbox`.

Responsibilities:

- connect to local OpenClaw Gateway
- create a temporary session for a trial
- bind the selected agent to that session
- start the trial interaction
- subscribe to session events
- map session events into Trial Arena `RunEvent`
- close the temporary session when the run completes or aborts

This unit should not decide which agent to choose or whether to create one. It only executes a run with a resolved agent identity.

### Gateway Connection Contract

The first version should use a narrow, explicit gateway connection contract:

- default endpoint: `ws://127.0.0.1:18789`
- configurable endpoint override via server environment configuration
- optional auth token/password support via server environment configuration
- session bootstrap parameters are supplied by Trial Arena, not inferred ad hoc in UI code

This keeps the first implementation local-first while still allowing controlled overrides for development and testing.

### Agent Provisioning Service

Add a narrow provisioning layer used when discovery finds no local agents.

Responsibilities:

- accept a desired agent name
- create a minimal valid OpenClaw agent definition
- invoke `openclaw agents add`
- report success/failure
- refresh discovery state after creation

This unit should not be mixed into the gateway adapter. Provisioning and execution are separate responsibilities.

## Trial Run Flow

The runtime lifecycle for a real OpenClaw-backed run should be:

1. user provides OpenClaw working-directory root path
2. resolver locates `.openclaw`
3. resolver reads existing agent definitions
4. if agents exist, UI prompts the user to choose one
5. if no agents exist, UI prompts whether to create one
6. if user agrees, provisioning service creates a minimal agent
7. orchestrator starts the run
8. sandbox adapter creates a fresh temporary OpenClaw session
9. adapter binds the chosen agent to the session
10. adapter subscribes to session events
11. adapter maps gateway events into `RunEvent`
12. orchestrator stores events and drives replay/judge/admission
13. adapter emits `run.completed`
14. adapter closes the temporary session

Key invariant:

`one trial run = one temporary OpenClaw session`

Replay must depend on Trial Arena’s stored event log, not on the OpenClaw session continuing to exist after completion.

## Terminal And Failure Semantics

The OpenClaw-backed path must still terminate through the existing Trial Arena event model.

Rules:

- every started run must end with exactly one `run.completed`
- successful OpenClaw execution maps to `run.completed` with a passed or failed `ScenarioResult`
- infrastructure/runtime failures map to `run.completed` with `outcome: "errored"`
- the adapter may emit one or more `judge.update` events before terminal completion to explain discovery, provisioning, connection, session, or mapping failures
- replay must include the failure-path events that happened before `run.completed`

This keeps orchestration, replay, and judge logic consistent even when the OpenClaw runtime fails before producing a useful agent result.

## Event Mapping Strategy

The first version should map OpenClaw session activity into the existing `RunEvent` model rather than inventing a new frontend protocol.

Required mapped events:

- `run.started`
- `agent.summary`
- `tool.called`
- `judge.update`
- `run.completed`

Suggested mapping:

- session created -> `run.started`
- agent output / assistant progress messages -> `agent.summary`
- tool invocation events -> `tool.called`
- adapter stage updates / runtime status -> `judge.update`
- session terminal state -> `run.completed`

The first version should also retain a raw gateway event snapshot internally for debugging and later fidelity improvements, but should not expose raw gateway protocol directly to the frontend yet.

This gives the frontend and judge pipeline enough continuity to remain useful while avoiding a premature coupling to OpenClaw’s raw event schema.

## Agent Discovery

The first version should support selection from existing local OpenClaw agents.

Given a user-provided OpenClaw working-directory root path:

- locate `.openclaw`
- enumerate locally defined agents
- return a list of stable agent descriptors to the UI

If one or more agents exist:

- show them in Trial Arena
- require the user to pick which agent to test before starting the trial using the stable `agentId`

Trial Arena should not assume a default agent when multiple exist. The user must choose explicitly.

## Agent Provisioning

If discovery finds no local agents, Trial Arena should offer to create one.

The first version should keep provisioning minimal:

- ask only for an `agent name`
- use a fixed minimal template for the rest of the definition
- execute `openclaw agents add`
- refresh discovery state
- inform the user clearly that the agent has been created

Provisioning rules:

- duplicate agent names should be rejected with a clear user-facing message
- invalid names should fail before session creation begins
- successful provisioning should return the newly discovered stable agent descriptor, not just a success boolean

Important product boundary:

Trial Arena is not becoming a full OpenClaw agent authoring UI in this pass.
It only creates the smallest valid local agent necessary to proceed with production-oriented trial testing.

## UI Impact

The `/builds` flow needs one new runtime-preparation branch before `Start trial`:

1. user enters OpenClaw working-directory root path
2. Trial Arena resolves local agents
3. if agents exist, user chooses one
4. if no agents exist, Trial Arena offers creation
5. once a target agent exists, the user can start the trial

The rest of the arena flow should stay intact:

- `/arena/[runId]` still renders timeline, result, and judge output
- `/replay/[runId]` still renders replay from stored events

This is important. The OpenClaw integration should replace the runtime source, not rewrite the product surface.

## Error Handling

Expected failure cases:

- invalid working-directory root path
- `.openclaw` not found
- gateway unavailable
- gateway connection refused
- agent discovery fails
- `openclaw agents add` fails
- session creation fails
- session closes early
- runtime event mapping encounters unknown event shapes

First-version handling should be conservative:

- fail early with explicit, user-facing error messages
- keep partial run state for debugging where possible
- close temporary sessions on any terminal failure path
- record enough adapter-side detail to explain whether failure happened during discovery, provisioning, connection, session creation, or execution
- still terminate the run through a final `run.completed` errored result once a run has started

## Testing Strategy

Add tests at three levels.

### 1. Resolver and provisioning tests

- resolves `.openclaw` from a user-provided root path
- lists available agent definitions
- handles “no agents found”
- handles malformed workspace paths
- verifies minimal agent provisioning command construction

### 2. Sandbox adapter tests

- creates a temporary session per run
- maps representative gateway events into `RunEvent`
- closes session on completion
- closes session on failure
- preserves replay event order

These should use deterministic mocked gateway traffic rather than requiring a real gateway in unit tests.

### 3. API / orchestration tests

- start run with chosen OpenClaw agent
- store event stream and replay
- return run summary after OpenClaw-backed execution

The existing scripted path should remain available for deterministic end-to-end tests until a stable mocked OpenClaw integration harness exists.

## Manual Smoke Checklist

1. Start OpenClaw Gateway on `ws://127.0.0.1:18789`.
2. Start the API with `OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789`.
3. Start the web app with `OPENCLAW_API_BASE_URL=http://127.0.0.1:3001`.
4. Open `/builds`, enter an OpenClaw workspace root, and load agents.
5. If no agents exist, create one with the minimal agent-name form and confirm the UI reports the new agent.
6. Start a trial and confirm `/arena/[runId]` shows mapped timeline events, scenario result, judge output, and admission output.
7. Open `/replay/[runId]` and confirm stored replay events still render after the temporary OpenClaw session has closed.

## Recommendation

Implement this in one focused OpenClaw-only slice:

- workspace resolver
- agent discovery / minimal provisioning
- gateway-backed sandbox adapter
- orchestration wiring
- build-screen runtime selection step

Do not generalize this into a multi-runtime abstraction yet.
The fastest path to a production-relevant trial loop is to make OpenClaw work cleanly first, with one temporary session and one explicit agent selection path.
