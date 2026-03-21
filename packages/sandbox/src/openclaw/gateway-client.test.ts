import { describe, expect, it, vi } from "vitest";
import { OpenClawGatewayClient } from "./gateway-client.js";

describe("OpenClawGatewayClient", () => {
  it("uses official agent/agent.wait/sessions.get/sessions.delete methods", async () => {
    const callGatewayMock = vi.fn(async (input: { readonly method: string }) => {
      switch (input.method) {
        case "agent":
          return { runId: "run-001" };
        case "agent.wait":
          return { runId: "run-001", status: "ok" };
        case "sessions.get":
          return {
            messages: [
              {
                role: "assistant",
                content: [
                  { type: "text", text: "Inspecting workspace." },
                  { type: "tool_use", name: "bash", input: { command: "ls" } }
                ]
              }
            ]
          };
        case "sessions.delete":
          return { ok: true };
        default:
          throw new Error(`Unexpected method: ${input.method}`);
      }
    });
    const callGateway = (<T>(input: { readonly method: string }) =>
      callGatewayMock(input) as Promise<T>) as <T>(input: {
      readonly method: string;
    }) => Promise<T>;
    const client = new OpenClawGatewayClient({
      url: "ws://127.0.0.1:18789",
      callGateway
    });

    const session = await client.createSession({
      agentId: "main",
      message: "Run benchmark.",
      idempotencyKey: "run-001",
      sessionKey: "agent:main:trial-arena:run-001"
    });

    const events = [];
    for await (const event of client.subscribeSession(session)) {
      events.push(event);
    }

    await client.closeSession(session);

    expect(session).toEqual({
      runId: "run-001",
      sessionKey: "agent:main:trial-arena:run-001"
    });
    expect(callGatewayMock.mock.calls.map(([input]) => input.method)).toEqual([
      "agent",
      "agent.wait",
      "sessions.get",
      "sessions.delete"
    ]);
    expect(events).toEqual([
      {
        type: "status",
        summary: "OpenClaw run accepted: run-001"
      },
      {
        type: "assistant_message",
        sessionId: undefined,
        text: "Inspecting workspace."
      },
      {
        type: "tool_call",
        sessionId: undefined,
        toolName: "bash",
        input: { command: "ls" }
      },
      {
        type: "session.completed",
        sessionId: undefined,
        summary: "OpenClaw agent run completed."
      }
    ]);
  });

  it("turns an agent.wait timeout into a terminal session error", async () => {
    const callGatewayMock = vi.fn(async (input: { readonly method: string }) => {
      if (input.method === "agent") {
        return { runId: "run-timeout" };
      }

      if (input.method === "agent.wait") {
        return { runId: "run-timeout", status: "timeout" };
      }

      throw new Error(`Unexpected method: ${input.method}`);
    });
    const client = new OpenClawGatewayClient({
      url: "ws://127.0.0.1:18789",
      callGateway: (<T>(input: { readonly method: string }) =>
        callGatewayMock(input) as Promise<T>) as <T>(input: {
        readonly method: string;
      }) => Promise<T>
    });

    const session = await client.createSession({
      agentId: "main",
      message: "Run benchmark.",
      sessionKey: "agent:main:trial-arena:run-timeout"
    });

    const events = [];
    for await (const event of client.subscribeSession(session)) {
      events.push(event);
    }

    expect(events.at(-1)).toEqual({
      type: "session.error",
      sessionId: undefined,
      summary: "OpenClaw agent.wait timed out for run run-timeout."
    });
  });
});
