import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("analysis routes", () => {
  it("returns persisted run analysis for a stored run", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/runs",
      payload: {
        agentVersion: "agent-v1",
        build: {
          robustness: "high",
          safetyDiscipline: "high"
        },
        judgeConfigVersion: "judge-v1",
        seed: "seed-123",
        agentName: "cautiousPlanner"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const createdRun = createResponse.json();
    const analysisResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdRun.runId}/analysis`
    });

    expect(analysisResponse.statusCode).toBe(200);
    expect(analysisResponse.json()).toMatchObject({
      reportVersion: "v1",
      runId: createdRun.runId,
      scenarioId: expect.any(String),
      confidence: "medium",
      comparisonKeys: {
        failureClasses: expect.any(Array),
        affectedDimensions: expect.any(Array),
        suggestedChangeTypes: expect.any(Array)
      }
    });

    await app.close();
  });

  it("returns 404 for unknown runs", async () => {
    const app = buildApp();

    const analysisResponse = await app.inject({
      method: "GET",
      url: "/runs/run-missing/analysis"
    });

    expect(analysisResponse.statusCode).toBe(404);
    expect(analysisResponse.json()).toEqual({
      message: "Unknown run: run-missing"
    });

    await app.close();
  });
});
