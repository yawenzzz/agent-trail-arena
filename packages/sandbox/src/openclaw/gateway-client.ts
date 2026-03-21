import { executeOpenClawJsonCommand } from "./command-runner.js";

const DEFAULT_GATEWAY_TIMEOUT_MS = 20_000;
const DEFAULT_AGENT_WAIT_TIMEOUT_MS = 10 * 60 * 1000;

export interface OpenClawGatewayConfig {
  readonly url: string;
  readonly token?: string;
  readonly password?: string;
  readonly callGateway?: <T>(
    input: OpenClawGatewayCallInput
  ) => Promise<T>;
}

export interface OpenClawGatewayCallInput {
  readonly method: string;
  readonly params?: Record<string, unknown>;
  readonly expectFinal?: boolean;
  readonly timeoutMs?: number;
}

export interface OpenClawGatewaySession {
  readonly runId: string;
  readonly sessionKey: string;
  readonly sessionId?: string;
}

export interface OpenClawCreateSessionInput {
  readonly agentId: string;
  readonly message: string;
  readonly sessionKey: string;
  readonly idempotencyKey?: string;
  readonly workspaceRoot?: string;
}

export type OpenClawGatewayEvent =
  | { type: "assistant_message"; text: string; sessionId?: string }
  | { type: "tool_call"; toolName: string; input: unknown; sessionId?: string }
  | { type: "status"; summary: string; sessionId?: string }
  | {
      type: "session.completed";
      summary?: string;
      outcome?: "passed" | "failed";
      sessionId?: string;
    }
  | { type: "session.error"; summary: string; sessionId?: string }
  | { type: string; sessionId?: string; [key: string]: unknown };

export interface OpenClawGateway {
  createSession(input: OpenClawCreateSessionInput): Promise<OpenClawGatewaySession>;
  subscribeSession(session: OpenClawGatewaySession): AsyncGenerator<OpenClawGatewayEvent>;
  closeSession(session: OpenClawGatewaySession): Promise<void>;
}

interface OpenClawAgentAcceptedResponse {
  readonly runId?: string;
}

interface OpenClawAgentWaitResponse {
  readonly runId?: string;
  readonly status?: "ok" | "error" | "timeout";
  readonly summary?: string;
  readonly error?: string;
}

interface OpenClawSessionMessagePart {
  readonly type?: string;
  readonly text?: string;
  readonly name?: string;
  readonly input?: unknown;
}

interface OpenClawSessionMessage {
  readonly role?: string;
  readonly content?: readonly OpenClawSessionMessagePart[];
}

interface OpenClawSessionTranscript {
  readonly messages?: readonly OpenClawSessionMessage[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSessionIdFromTranscript(
  transcript: OpenClawSessionTranscript
): string | undefined {
  for (const message of transcript.messages ?? []) {
    if (!Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!isObject(part)) {
        continue;
      }

      const text = typeof part.text === "string" ? part.text : undefined;
      if (!text) {
        continue;
      }

      const match = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (match) {
        return match[0];
      }
    }
  }

  return undefined;
}

function mapTranscriptToEvents(
  transcript: OpenClawSessionTranscript,
  sessionId?: string
): OpenClawGatewayEvent[] {
  const events: OpenClawGatewayEvent[] = [];

  for (const message of transcript.messages ?? []) {
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }

    for (const part of message.content) {
      if (!isObject(part) || typeof part.type !== "string") {
        continue;
      }

      if (part.type === "text" && typeof part.text === "string" && part.text.trim().length > 0) {
        events.push({
          type: "assistant_message",
          text: part.text,
          sessionId
        });
        continue;
      }

      if (
        (part.type === "tool_use" || part.type === "tool-call") &&
        typeof part.name === "string" &&
        part.name.trim().length > 0
      ) {
        events.push({
          type: "tool_call",
          toolName: part.name,
          input: part.input,
          sessionId
        });
      }
    }
  }

  return events;
}

export class OpenClawGatewayClient implements OpenClawGateway {
  readonly #config: OpenClawGatewayConfig;

  constructor(config: OpenClawGatewayConfig) {
    this.#config = config;
  }

  async createSession(
    input: OpenClawCreateSessionInput
  ): Promise<OpenClawGatewaySession> {
    const runId =
      input.idempotencyKey && input.idempotencyKey.trim().length > 0
        ? input.idempotencyKey
        : input.sessionKey;
    const result = await this.#callGateway<OpenClawAgentAcceptedResponse>({
      method: "agent",
      timeoutMs: DEFAULT_GATEWAY_TIMEOUT_MS,
      params: {
        agentId: input.agentId,
        message: input.message,
        idempotencyKey: runId,
        sessionKey: input.sessionKey
      }
    });

    if (typeof result.runId !== "string" || result.runId.trim().length === 0) {
      throw new Error("OpenClaw Gateway agent run did not return a runId.");
    }

    return {
      runId: result.runId,
      sessionKey: input.sessionKey
    };
  }

  async *subscribeSession(
    session: OpenClawGatewaySession
  ): AsyncGenerator<OpenClawGatewayEvent> {
    yield {
      type: "status",
      summary: `OpenClaw run accepted: ${session.runId}`
    };

    const waitResult = await this.#callGateway<OpenClawAgentWaitResponse>({
      method: "agent.wait",
      timeoutMs: DEFAULT_AGENT_WAIT_TIMEOUT_MS,
      params: {
        runId: session.runId,
        timeoutMs: DEFAULT_AGENT_WAIT_TIMEOUT_MS
      }
    });

    if (waitResult.status === "timeout") {
      yield {
        type: "session.error",
        sessionId: session.sessionId,
        summary: `OpenClaw agent.wait timed out for run ${session.runId}.`
      };
      return;
    }

    if (waitResult.status === "error") {
      yield {
        type: "session.error",
        sessionId: session.sessionId,
        summary:
          typeof waitResult.error === "string" && waitResult.error.trim().length > 0
            ? waitResult.error
            : `OpenClaw run ${session.runId} failed.`
      };
      return;
    }

    const transcript = await this.#callGateway<OpenClawSessionTranscript>({
      method: "sessions.get",
      timeoutMs: DEFAULT_GATEWAY_TIMEOUT_MS,
      params: {
        key: session.sessionKey
      }
    });
    const sessionId = session.sessionId ?? readSessionIdFromTranscript(transcript);

    for (const event of mapTranscriptToEvents(transcript, sessionId)) {
      yield event;
    }

    yield {
      type: "session.completed",
      sessionId,
      summary:
        typeof waitResult.summary === "string" && waitResult.summary.trim().length > 0
          ? waitResult.summary
          : "OpenClaw agent run completed."
    };
  }

  async closeSession(session: OpenClawGatewaySession): Promise<void> {
    await this.#callGateway({
      method: "sessions.delete",
      timeoutMs: DEFAULT_GATEWAY_TIMEOUT_MS,
      params: {
        key: session.sessionKey
      }
    });
  }

  async #callGateway<T>(input: OpenClawGatewayCallInput): Promise<T> {
    if (this.#config.callGateway) {
      return this.#config.callGateway<T>(input);
    }

    const args = [
      "gateway",
      "call",
      input.method,
      "--json",
      "--timeout",
      String(input.timeoutMs ?? DEFAULT_GATEWAY_TIMEOUT_MS)
    ];

    if (input.expectFinal) {
      args.push("--expect-final");
    }

    if (this.#config.url.trim().length > 0) {
      args.push("--url", this.#config.url);
    }

    if (typeof this.#config.token === "string" && this.#config.token.trim().length > 0) {
      args.push("--token", this.#config.token);
    }

    if (
      typeof this.#config.password === "string" &&
      this.#config.password.trim().length > 0
    ) {
      args.push("--password", this.#config.password);
    }

    args.push("--params", JSON.stringify(input.params ?? {}));

    return executeOpenClawJsonCommand<T>({
      args
    });
  }
}
