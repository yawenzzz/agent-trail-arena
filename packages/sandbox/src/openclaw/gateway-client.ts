export interface OpenClawGatewayConfig {
  readonly url: string;
  readonly token?: string;
  readonly password?: string;
}

export interface OpenClawGatewaySession {
  readonly sessionId: string;
}

export interface OpenClawCreateSessionInput {
  readonly agentId: string;
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
  subscribeSession(sessionId: string): AsyncGenerator<OpenClawGatewayEvent>;
  closeSession(sessionId: string): Promise<void>;
}

interface GatewayRequest {
  readonly id: string;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

interface GatewayResponseSuccess {
  readonly id: string;
  readonly result?: unknown;
}

interface GatewayResponseError {
  readonly id: string;
  readonly error: { readonly message?: string };
}

interface GatewayEventEnvelope {
  readonly event: OpenClawGatewayEvent;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSessionId(result: unknown, fallbackSessionId?: string): string {
  if (isObject(result) && typeof result.sessionId === "string" && result.sessionId.length > 0) {
    return result.sessionId;
  }

  if (typeof fallbackSessionId === "string" && fallbackSessionId.length > 0) {
    return fallbackSessionId;
  }

  throw new Error("OpenClaw Gateway response did not include a sessionId.");
}

export class OpenClawGatewayClient implements OpenClawGateway {
  readonly #config: OpenClawGatewayConfig;
  #socket: WebSocket | null = null;
  #connected = false;
  #requestCount = 0;
  readonly #pending = new Map<
    string,
    {
      readonly resolve: (value: unknown) => void;
      readonly reject: (error: Error) => void;
    }
  >();
  readonly #sessionQueues = new Map<string, OpenClawGatewayEvent[]>();
  readonly #sessionResolvers = new Map<
    string,
    ((value: IteratorResult<OpenClawGatewayEvent>) => void)[]
  >();
  readonly #knownSessions = new Set<string>();
  readonly #closedSessions = new Set<string>();

  constructor(config: OpenClawGatewayConfig) {
    this.#config = config;
  }

  async createSession(
    input: OpenClawCreateSessionInput
  ): Promise<OpenClawGatewaySession> {
    const result = await this.#request("session.create", {
      agentId: input.agentId,
      workspaceRoot: input.workspaceRoot
    });

    const sessionId = asSessionId(result);
    this.#knownSessions.add(sessionId);

    return {
      sessionId
    };
  }

  async *subscribeSession(sessionId: string): AsyncGenerator<OpenClawGatewayEvent> {
    this.#knownSessions.add(sessionId);
    await this.#request("session.subscribe", { sessionId });

    while (true) {
      const event = await this.#nextSessionEvent(sessionId);

      if (!event) {
        return;
      }

      yield event;

      if (event.type === "session.completed" || event.type === "session.error") {
        this.#closedSessions.add(sessionId);
        return;
      }
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    if (this.#closedSessions.has(sessionId)) {
      return;
    }

    await this.#request("session.close", { sessionId });
    this.#closedSessions.add(sessionId);
    this.#flushSession(sessionId, undefined);
  }

  async #connect(): Promise<void> {
    if (this.#connected) {
      return;
    }

    if (!this.#socket) {
      this.#socket = new WebSocket(this.#config.url);
      this.#socket.addEventListener("message", (event) => {
        this.#handleSocketMessage(event.data);
      });
      this.#socket.addEventListener("close", () => {
        this.#connected = false;
        this.#broadcastSessionFailure("OpenClaw Gateway connection closed.");
        for (const [requestId, pending] of this.#pending) {
          pending.reject(new Error("OpenClaw Gateway connection closed."));
          this.#pending.delete(requestId);
        }
      });
      this.#socket.addEventListener("error", () => {
        if (!this.#connected) {
          for (const [requestId, pending] of this.#pending) {
            pending.reject(new Error("Failed to connect to OpenClaw Gateway."));
            this.#pending.delete(requestId);
          }
        }
      });
    }

    if (this.#socket.readyState === WebSocket.OPEN) {
      await this.#bootstrap();
      return;
    }

    if (this.#socket.readyState !== WebSocket.CONNECTING) {
      throw new Error("OpenClaw Gateway socket is not available.");
    }

    await new Promise<void>((resolve, reject) => {
      const socket = this.#socket;

      if (!socket) {
        reject(new Error("OpenClaw Gateway socket is not available."));
        return;
      }

      const handleOpen = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        resolve();
      };
      const handleError = () => {
        socket.removeEventListener("open", handleOpen);
        socket.removeEventListener("error", handleError);
        reject(new Error("Failed to connect to OpenClaw Gateway."));
      };

      socket.addEventListener("open", handleOpen, { once: true });
      socket.addEventListener("error", handleError, { once: true });
    });

    await this.#bootstrap();
  }

  async #bootstrap(): Promise<void> {
    if (this.#connected) {
      return;
    }

    const socket = this.#socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("OpenClaw Gateway socket is not ready for bootstrap.");
    }

    await this.#sendRequest(socket, "connect", {
      token: this.#config.token,
      password: this.#config.password
    });
    this.#connected = true;
  }

  async #request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.#connect();

    const socket = this.#socket;
    if (!socket) {
      throw new Error("OpenClaw Gateway socket is not available.");
    }

    return this.#sendRequest(socket, method, params);
  }

  async #sendRequest(
    socket: WebSocket,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    this.#requestCount += 1;
    const id = `gateway-${this.#requestCount}`;

    const response = await new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });

      socket.send(
        JSON.stringify({
          id,
          method,
          params
        } satisfies GatewayRequest)
      );
    });

    return response;
  }

  #broadcastSessionFailure(summary: string): void {
    for (const sessionId of this.#knownSessions) {
      if (this.#closedSessions.has(sessionId)) {
        continue;
      }

      this.#flushSession(sessionId, {
        type: "session.error",
        sessionId,
        summary
      });
    }
  }

  #handleSocketMessage(payload: unknown): void {
    const parsed = this.#parseMessage(payload);

    if (!parsed) {
      return;
    }

    if ("id" in parsed) {
      const pending = this.#pending.get(parsed.id);
      if (!pending) {
        return;
      }

      this.#pending.delete(parsed.id);

      if ("error" in parsed) {
        pending.reject(
          new Error(parsed.error.message ?? "OpenClaw Gateway request failed.")
        );
        return;
      }

      pending.resolve(parsed.result);
      return;
    }

    const sessionId =
      typeof parsed.event.sessionId === "string" ? parsed.event.sessionId : undefined;
    if (!sessionId) {
      return;
    }

    this.#flushSession(sessionId, parsed.event);
  }

  #parseMessage(
    payload: unknown
  ): GatewayResponseSuccess | GatewayResponseError | GatewayEventEnvelope | null {
    if (typeof payload !== "string") {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }

    if (
      isObject(parsed) &&
      typeof parsed.id === "string" &&
      ("result" in parsed || "error" in parsed)
    ) {
      return parsed as unknown as GatewayResponseSuccess | GatewayResponseError;
    }

    if (
      isObject(parsed) &&
      "event" in parsed &&
      isObject(parsed.event) &&
      typeof parsed.event.type === "string"
    ) {
      return parsed as unknown as GatewayEventEnvelope;
    }

    return null;
  }

  #flushSession(sessionId: string, event: OpenClawGatewayEvent | undefined): void {
    const resolvers = this.#sessionResolvers.get(sessionId);

    if (resolvers && resolvers.length > 0) {
      const resolve = resolvers.shift();
      if (!resolve) {
        return;
      }

      resolve(
        event ? { done: false, value: event } : { done: true, value: undefined }
      );

      if (!event && resolvers.length === 0) {
        this.#sessionResolvers.delete(sessionId);
      }

      return;
    }

    if (!event) {
      this.#closedSessions.add(sessionId);
      return;
    }

    const queue = this.#sessionQueues.get(sessionId) ?? [];
    queue.push(event);
    this.#sessionQueues.set(sessionId, queue);
  }

  async #nextSessionEvent(
    sessionId: string
  ): Promise<OpenClawGatewayEvent | undefined> {
    const queue = this.#sessionQueues.get(sessionId);

    if (queue && queue.length > 0) {
      const next = queue.shift();
      if (queue.length === 0) {
        this.#sessionQueues.delete(sessionId);
      }
      return next;
    }

    if (this.#closedSessions.has(sessionId)) {
      return undefined;
    }

    return new Promise<IteratorResult<OpenClawGatewayEvent>>((resolve) => {
      const resolvers = this.#sessionResolvers.get(sessionId) ?? [];
      resolvers.push(resolve);
      this.#sessionResolvers.set(sessionId, resolvers);
    }).then((result) => (result.done ? undefined : result.value));
  }
}
