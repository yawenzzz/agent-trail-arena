import { expect, test } from "@playwright/test";

test("user can launch a mocked OpenClaw trial and open replay", async ({ page }) => {
  await page.route("http://127.0.0.1:3001/openclaw/resolve", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        workspaceRoot: "/tmp/openclaw-workspace",
        openclawRoot: "/tmp/openclaw-workspace/.openclaw",
        agents: [
          {
            agentId: "agent-1",
            agentName: "trial-agent",
            definitionPath: "/tmp/openclaw-workspace/.openclaw/agents/trial-agent.json",
            workspaceRoot: "/tmp/openclaw-workspace"
          }
        ]
      })
    });
  });
  await page.route("http://127.0.0.1:3001/runs", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        runId: "run-0001",
        streamPath: "/runs/run-0001/events",
        replayPath: "/runs/run-0001/replay"
      })
    });
  });
  await page.route("http://127.0.0.1:3001/runs/run-0001", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runId: "run-0001",
        scenario: {
          scenarioId: "scenario-1",
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
              scenarioId: "scenario-1",
              scenarioType: "workflow",
              outcome: "passed",
              summary: "Mocked OpenClaw trial passed."
            }
          ]
        }
      })
    });
  });
  await page.route("http://127.0.0.1:3001/runs/run-0001/events", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream; charset=utf-8",
      body: [
        'event: run.started\ndata: {"type":"run.started","runId":"run-0001","scenarioId":"scenario-1"}\n\n',
        'event: agent.summary\ndata: {"type":"agent.summary","text":"Mocked OpenClaw output."}\n\n',
        'event: run.completed\ndata: {"type":"run.completed","result":{"scenarioId":"scenario-1","scenarioType":"workflow","outcome":"passed","summary":"Mocked OpenClaw trial passed."}}\n\n'
      ].join("")
    });
  });
  await page.route("http://127.0.0.1:3001/runs/run-0001/replay", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        runId: "run-0001",
        events: [
          {
            type: "run.started",
            runId: "run-0001",
            scenarioId: "scenario-1"
          },
          {
            type: "agent.summary",
            text: "Mocked OpenClaw output."
          },
          {
            type: "run.completed",
            result: {
              scenarioId: "scenario-1",
              scenarioType: "workflow",
              outcome: "passed",
              summary: "Mocked OpenClaw trial passed."
            }
          }
        ]
      })
    });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "Start a new trial" }).click();
  await page.getByLabel("Workspace root").fill("/tmp/openclaw-workspace");
  await page.getByRole("button", { name: "Load agents" }).click();
  const agentSelect = page.locator('select[name="openclawAgentId"]');
  await expect(agentSelect).toBeVisible();
  await agentSelect.selectOption("agent-1");
  await page.getByRole("button", { name: "Start trial" }).click();
  await expect(page.getByText("Scenario Result")).toBeVisible();
  await page.getByRole("link", { name: "Open replay" }).click();
  await expect(page.getByText("Replay Timeline")).toBeVisible();
});
