import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("grade routes", () => {
  it("returns persisted grade assessment for a stored run", async () => {
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
    const gradeResponse = await app.inject({
      method: "GET",
      url: `/runs/${createdRun.runId}/grade`
    });

    expect(gradeResponse.statusCode).toBe(200);
    expect(gradeResponse.json()).toMatchObject({
      assessmentVersion: "v1",
      runId: createdRun.runId,
      scenarioId: expect.any(String),
      recommendedGrade: expect.any(String),
      gradeConfidence: "medium",
      authorizedScope: expect.any(Array),
      restrictedScope: expect.any(Array),
      promotionGaps: expect.any(Array),
      blockingIssues: expect.any(Array),
      supportingEvidence: expect.any(Array)
    });

    await app.close();
  });

  it("returns 404 for unknown runs", async () => {
    const app = buildApp();

    const gradeResponse = await app.inject({
      method: "GET",
      url: "/runs/run-missing/grade"
    });

    expect(gradeResponse.statusCode).toBe(404);
    expect(gradeResponse.json()).toEqual({
      message: "Unknown run: run-missing"
    });

    await app.close();
  });
});
