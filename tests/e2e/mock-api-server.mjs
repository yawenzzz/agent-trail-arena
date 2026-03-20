import http from "node:http";

const host = "127.0.0.1";
const port = 3001;

const runId = "run-0001";
const scenarioId = "scenario-1";

function json(body, status = 200) {
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function sse(body, status = 200) {
  return {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      "content-type": "text/event-stream; charset=utf-8"
    },
    body
  };
}

const routes = new Map([
  [
    "POST /openclaw/resolve",
    json({
      stateRoot: "/tmp/openclaw-state",
      configPath: "/tmp/openclaw-state/openclaw.json",
      agents: [
        {
          agentId: "agent-1",
          agentName: "trial-agent",
          definitionPath: "/tmp/openclaw-state/openclaw.json",
          workspaceRoot: "/tmp/openclaw-state/workspace-agent-1"
        }
      ]
    })
  ],
  [
    "POST /runs",
    json({
      runId,
      streamPath: `/runs/${runId}/events`,
      replayPath: `/runs/${runId}/replay`
    }, 201)
  ],
  [
    `GET /runs/${runId}`,
    json({
      runId,
      scenario: {
        scenarioId,
        title: "Mocked OpenClaw Trial",
        type: "workflow",
        goal: "Validate the OpenClaw arena flow.",
        allowedTools: ["bash"],
        environmentConstraints: ["mocked"],
        expectedArtifacts: ["report.md"],
        targetedAttributes: ["planning", "robustness"],
        redLines: ["data loss"],
        defaultScoreDimensions: ["correctness"],
        supportedJudges: ["rule-judge"]
      },
      judge: {
        summary: "Mocked trial completed cleanly.",
        findings: [],
        redLineTriggered: false
      },
      admission: {
        status: "production-ready",
        explanation: "Mocked OpenClaw trial passed."
      },
      measuredProfile: {
        attributes: {
          planning: 0.8,
          robustness: 0.9
        },
        scenarioResults: [
          {
            scenarioId,
            scenarioType: "workflow",
            outcome: "passed",
            summary: "Mocked OpenClaw trial passed."
          }
        ]
      }
    })
  ],
  [
    `GET /runs/${runId}/events`,
    sse(
      [
        `event: run.started\ndata: ${JSON.stringify({
          type: "run.started",
          runId,
          scenarioId
        })}\n\n`,
        `event: agent.summary\ndata: ${JSON.stringify({
          type: "agent.summary",
          text: "Mocked OpenClaw output."
        })}\n\n`,
        `event: run.completed\ndata: ${JSON.stringify({
          type: "run.completed",
          result: {
            scenarioId,
            scenarioType: "workflow",
            outcome: "passed",
            summary: "Mocked OpenClaw trial passed."
          }
        })}\n\n`
      ].join("")
    )
  ],
  [
    `GET /runs/${runId}/replay`,
    json({
      runId,
      events: [
        {
          type: "run.started",
          runId,
          scenarioId
        },
        {
          type: "agent.summary",
          text: "Mocked OpenClaw output."
        },
        {
          type: "run.completed",
          result: {
            scenarioId,
            scenarioType: "workflow",
            outcome: "passed",
            summary: "Mocked OpenClaw trial passed."
          }
        }
      ]
    })
  ]
]);

const server = http.createServer(async (request, response) => {
  const method = request.method ?? "GET";
  const path = request.url ?? "/";

  if (method === "OPTIONS") {
    response.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type"
    });
    response.end();
    return;
  }

  if (method === "POST") {
    for await (const _chunk of request) {
      // Drain the request body so Node can reuse the socket cleanly.
    }
  }

  const route = routes.get(`${method} ${path}`);

  if (!route) {
    response.writeHead(404, {
      "access-control-allow-origin": "*",
      "content-type": "application/json"
    });
    response.end(JSON.stringify({ message: `Unknown mock route: ${method} ${path}` }));
    return;
  }

  response.writeHead(route.status, route.headers);
  response.end(route.body);
});

server.listen(port, host, () => {
  process.stdout.write(`Mock API listening on http://${host}:${port}\n`);
});
