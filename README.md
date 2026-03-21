# OpenClaw Trial Arena

Monorepo for a local trial harness that can benchmark an OpenClaw agent, show the run in an arena view, and replay the captured transcript.

## Packages

- `apps/web`: Next.js UI for build setup, arena, and replay
- `apps/api`: Fastify API for workspace resolution, agent provisioning, runs, replay, and SSE export
- `packages/domain`: shared trial, scenario, judge, and event types
- `packages/registry`: benchmark scenario registry and selection logic
- `packages/sandbox`: scripted runner plus OpenClaw runtime integration
- `packages/judge`: rule-based judge and admission output
- `packages/orchestrator`: run lifecycle, store, stream, and finalize logic

## Requirements

- Node.js 22+
- `pnpm`
- Local `openclaw` CLI installed and working
- Local OpenClaw Gateway running

This project currently assumes the local gateway is reachable at `ws://127.0.0.1:18789`.

## Install

```bash
pnpm install
```

## Run Locally

Start the API:

```bash
pnpm --dir apps/api exec node --import tsx src/server.ts
```

Start the web app in another terminal:

```bash
OPENCLAW_API_BASE_URL=http://127.0.0.1:3001 pnpm --dir apps/web dev --hostname 127.0.0.1 --port 3000
```

Open:

```text
http://127.0.0.1:3000/builds
```

Quick health check for the API:

```bash
curl http://127.0.0.1:3001/health
```

Expected response:

```json
{"scaffold":false,"status":"ok"}
```

## How To Test A Local OpenClaw Agent

### 1. Confirm OpenClaw works outside Trial Arena

Make sure these commands work first:

```bash
openclaw --version
openclaw agents list --json
openclaw gateway call agent --json --params '{
  "agentId": "main",
  "message": "reply exactly OK and nothing else",
  "idempotencyKey": "trial-arena-smoke-test",
  "sessionKey": "agent:main:trial-arena:smoke-test"
}'
```

If those fail, fix your local OpenClaw setup before debugging Trial Arena.

### 2. Fill the correct path in `/builds`

Trial Arena expects the OpenClaw **work directory root**, not the `.openclaw` directory itself.

If your state is here:

```text
/Users/you/.openclaw
```

Fill this in the UI:

```text
/Users/you
```

Do not fill:

```text
/Users/you/.openclaw
```

### 3. Resolve agents

On the build screen:

1. Enter the work directory root.
2. Click `Resolve local agents`.
3. Pick one of the discovered agent names.

Agent discovery now uses the official CLI:

```bash
openclaw agents list --json
```

It does not scan random files under `.openclaw/agents/**`.

### 4. Create an agent if none exist

If no agents are found:

1. Enter a new agent name.
2. Click `Create agent`.
3. Trial Arena will run `openclaw agents add` with a minimal template.
4. Select the created agent and start the trial.

### 5. Start a benchmark run

After selecting an agent:

1. Adjust the build allocation bars.
2. Click `Start trial`.
3. The app should navigate to `/arena/<runId>`.
4. From there you can open `/replay/<runId>`.

## Runtime Behavior

The OpenClaw integration is currently aligned to the official CLI/RPC flow:

- Agent discovery: `openclaw agents list --json`
- Agent creation: `openclaw agents add`
- Benchmark run start: `openclaw gateway call agent`
- Run completion wait: `openclaw gateway call agent.wait`
- Transcript fetch: `openclaw gateway call sessions.get`
- Session cleanup: `openclaw gateway call sessions.delete`

The benchmark run uses a temporary session key per trial. The session is deleted after the run finishes.

## Current Limitation

Arena and replay are not yet backed by the live Gateway WebSocket event stream.

Right now the system waits for the run to finish, then reconstructs timeline events from `sessions.get`. That means:

- Real OpenClaw agent runs are supported
- Replay works
- Timeline is not truly live yet

## Troubleshooting

### `500` when resolving agents

The most common cause is the wrong path. Use the work directory root, not `.openclaw`.

### `Malformed OpenClaw agent definition ... models.json: missing string name`

That error indicates you were previously reading the wrong files. Current code should not do that anymore. Agent discovery should come from:

```bash
openclaw agents list --json
```

### API starts and looks like it is doing nothing

That is normal. The server does not print a startup banner. Use:

```bash
curl http://127.0.0.1:3001/health
```

### Web cannot reach the API

Make sure you started the web app with:

```bash
OPENCLAW_API_BASE_URL=http://127.0.0.1:3001 pnpm --dir apps/web dev --hostname 127.0.0.1 --port 3000
```

## Tests

Run unit tests:

```bash
pnpm test
```

Run end-to-end tests:

```bash
pnpm test:e2e
```

Run targeted OpenClaw integration tests:

```bash
pnpm exec vitest run \
  packages/sandbox/src/openclaw/gateway-client.test.ts \
  packages/sandbox/src/openclaw/runner.test.ts \
  packages/sandbox/src/openclaw/workspace-resolver.test.ts \
  packages/orchestrator/src/start-run.test.ts \
  apps/api/src/routes/runs.test.ts \
  apps/api/src/routes/openclaw.test.ts \
  packages/sandbox/src/openclaw/agent-provisioner.test.ts
```
