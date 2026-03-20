import type {
  AdmissionResult,
  DeclaredBuild,
  JudgeResult,
  MeasuredProfile,
  OpenClawAgentDescriptor,
  OpenClawRuntimeTarget,
  ResolvedOpenClawWorkspace,
  RunEvent,
  ScenarioDefinition
} from "./trial-types";

const API_BASE_URL = process.env.OPENCLAW_API_BASE_URL ?? "http://127.0.0.1:3001";

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return typeof body.message === "string" && body.message.length > 0
      ? body.message
      : fallback;
  } catch {
    return fallback;
  }
}

export interface CreateRunRequest {
  readonly agentVersion: string;
  readonly build: DeclaredBuild;
  readonly judgeConfigVersion: string;
  readonly seed: string;
  readonly runtime: OpenClawRuntimeTarget;
}

export interface CreatedRun {
  readonly runId: string;
  readonly streamPath: string;
  readonly replayPath: string;
}

export interface RunSummary {
  readonly runId: string;
  readonly scenario: ScenarioDefinition;
  readonly judge: JudgeResult;
  readonly admission: AdmissionResult;
  readonly measuredProfile: MeasuredProfile;
}

export interface ReplayResponse {
  readonly runId: string;
  readonly events: readonly RunEvent[];
}

export async function resolveOpenClawWorkspace(input: {
  readonly stateRoot?: string;
  readonly configPath?: string;
}): Promise<ResolvedOpenClawWorkspace> {
  const response = await fetch(`${API_BASE_URL}/openclaw/resolve`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        `Failed to resolve OpenClaw state: ${response.status}`
      )
    );
  }

  return response.json();
}

export async function provisionOpenClawAgent(input: {
  readonly stateRoot?: string;
  readonly configPath?: string;
  readonly agentName: string;
}): Promise<OpenClawAgentDescriptor> {
  const response = await fetch(`${API_BASE_URL}/openclaw/provision`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(
        response,
        `Failed to provision OpenClaw agent: ${response.status}`
      )
    );
  }

  const body = (await response.json()) as { agent: OpenClawAgentDescriptor };
  return body.agent;
}

export async function createRun(input: CreateRunRequest): Promise<CreatedRun> {
  const response = await fetch(`${API_BASE_URL}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, `Failed to create run: ${response.status}`)
    );
  }

  return response.json();
}

export async function getRunSummary(runId: string): Promise<RunSummary> {
  const response = await fetch(`${API_BASE_URL}/runs/${runId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load run summary: ${response.status}`);
  }

  return response.json();
}

export async function getReplay(runId: string): Promise<ReplayResponse> {
  const response = await fetch(`${API_BASE_URL}/runs/${runId}/replay`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load replay: ${response.status}`);
  }

  return response.json();
}

export async function getRunEvents(runId: string): Promise<readonly RunEvent[]> {
  const response = await fetch(`${API_BASE_URL}/runs/${runId}/events`, {
    cache: "no-store",
    headers: {
      accept: "text/event-stream"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load event stream: ${response.status}`);
  }

  const streamText = await response.text();
  const { parseSseEvents } = await import("./event-stream");
  return parseSseEvents(streamText);
}
