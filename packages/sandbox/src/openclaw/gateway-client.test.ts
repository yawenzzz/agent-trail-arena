import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenClawGatewayClient } from "./gateway-client.js";

type Listener = (event?: { readonly data?: string }) => void;

async function flushMicrotasks(count = 1): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly sentMessages: string[] = [];
  readonly #listeners = new Map<string, Set<Listener>>();
  readyState = FakeWebSocket.CONNECTING;

  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.emit("open");
    });
  }

  addEventListener(type: string, listener: Listener, options?: { readonly once?: boolean }): void {
    const listeners = this.#listeners.get(type) ?? new Set<Listener>();

    if (options?.once) {
      const onceListener: Listener = (event) => {
        listeners.delete(onceListener);
        listener(event);
      };
      listeners.add(onceListener);
    } else {
      listeners.add(listener);
    }

    this.#listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.#listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    this.sentMessages.push(data);

    const message = JSON.parse(data) as {
      readonly id: string;
      readonly method: string;
      readonly params?: { readonly sessionId?: string };
    };

    queueMicrotask(() => {
      if (message.method === "connect") {
        this.emit("message", { data: JSON.stringify({ id: message.id, result: { ok: true } }) });
        return;
      }

      if (message.method === "session.create") {
        this.emit("message", {
          data: JSON.stringify({ id: message.id, result: { sessionId: "session-1" } })
        });
        return;
      }

      if (message.method === "session.subscribe") {
        this.emit("message", { data: JSON.stringify({ id: message.id, result: { ok: true } }) });
        return;
      }

      if (message.method === "session.close") {
        this.emit("message", { data: JSON.stringify({ id: message.id, result: { ok: true } }) });
      }
    });
  }

  triggerClose(): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close");
  }

  private emit(type: string, event?: { readonly data?: string }): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});

describe("OpenClawGatewayClient", () => {
  it("bootstraps once and creates a session without recursive connect loops", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const client = new OpenClawGatewayClient({
      url: "ws://127.0.0.1:18789"
    });

    const session = await client.createSession({
      agentId: "agent-1"
    });

    expect(session).toEqual({ sessionId: "session-1" });

    const socket = FakeWebSocket.instances[0];
    expect(socket?.sentMessages.map((message) => JSON.parse(message).method)).toEqual([
      "connect",
      "session.create"
    ]);
  });

  it("turns socket closure into a terminal session error event for subscribers", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const client = new OpenClawGatewayClient({
      url: "ws://127.0.0.1:18789"
    });

    const events = client.subscribeSession("session-1");
    const firstEventPromise = events.next();

    await flushMicrotasks(5);

    FakeWebSocket.instances[0]?.triggerClose();

    await expect(firstEventPromise).resolves.toEqual({
      done: false,
      value: {
        type: "session.error",
        sessionId: "session-1",
        summary: "OpenClaw Gateway connection closed."
      }
    });
  });
});
