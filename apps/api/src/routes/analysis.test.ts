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
    const runResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdRun.runId}`
    });
    const analysisResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdRun.runId}/analysis`
    });

    expect(runResponse.statusCode).toBe(200);
    expect(analysisResponse.statusCode).toBe(200);
    expect(analysisResponse.json()).toEqual(runResponse.json().runAnalysis);

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
