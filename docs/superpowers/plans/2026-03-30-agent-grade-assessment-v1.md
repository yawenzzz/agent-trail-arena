# Agent Grade Assessment V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-first qualification pipeline that derives `RunAnalysis` and `GradeAssessment` for each completed run, persists both artifacts, and exposes them through dedicated API routes.

**Architecture:** Keep the current runtime and deterministic judge flow intact, then layer a diagnosis stage and a grade-evaluation stage on top of stored run evidence. `packages/domain` owns the contracts, `packages/judge` owns deterministic evidence extraction and evaluation rules, `packages/orchestrator` persists the new artifacts, and `apps/api` serves them through focused read routes.

**Tech Stack:** TypeScript, Node.js, Fastify, Vitest

---

## File Structure

### Domain contracts

- Create: `packages/domain/src/analysis.ts`
  Defines evidence anchors, failure taxonomy enums, suggested changes, capability insights, and `RunAnalysis`.
- Create: `packages/domain/src/grades.ts`
  Defines common grade enums, authorization scope types, blocking issues, promotion gaps, and `GradeAssessment`.
- Create: `packages/domain/src/analysis.test.ts`
  Protects the shape of analysis contracts and comparison keys.
- Create: `packages/domain/src/grades.test.ts`
  Protects the grade ladder, authorization shape, and grade assessment contract.
- Modify: `packages/domain/src/index.ts`
  Re-export the new analysis and grade contracts.

### Judge and evaluation pipeline

- Create: `packages/judge/src/evidence-extractor.ts`
  Extracts stable evidence anchors from run events, replay events, and rule findings.
- Create: `packages/judge/src/failure-classifier.ts`
  Maps evidence plus judge signals into V1 failure patterns.
- Create: `packages/judge/src/run-analysis.ts`
  Builds `RunAnalysis` from scenario, events, replay, judge, admission, and measured profile.
- Create: `packages/judge/src/grade-evaluator.ts`
  Converts `RunAnalysis` plus direct judge signals into `GradeAssessment`.
- Create: `packages/judge/src/evidence-extractor.test.ts`
  Covers anchor extraction and anchor summaries.
- Create: `packages/judge/src/failure-classifier.test.ts`
  Covers deterministic failure-class assignment and severity.
- Create: `packages/judge/src/run-analysis.test.ts`
  Covers capability insights, suggested changes, and evidence linkage.
- Create: `packages/judge/src/grade-evaluator.test.ts`
  Covers grade recommendation, restricted scope, blocking issues, and promotion gaps.
- Modify: `packages/judge/src/index.ts`
  Export `analyzeRun`, `evaluateGrade`, and the new supporting types.

### Orchestrator persistence

- Modify: `packages/orchestrator/src/run-store.ts`
  Expand `StoredRun` to include `runAnalysis` and `gradeAssessment`.
- Modify: `packages/orchestrator/src/finalize-run.ts`
  Persist the new artifacts alongside existing run data.
- Modify: `packages/orchestrator/src/start-run.ts`
  Invoke `analyzeRun(...)` and `evaluateGrade(...)` after `judgeScenario(...)`.
- Modify: `packages/orchestrator/src/start-run.test.ts`
  Assert that stored runs now include both artifacts.

### API routes

- Create: `apps/api/src/routes/analysis.ts`
  Serves `GET /runs/:runId/analysis`.
- Create: `apps/api/src/routes/grade.ts`
  Serves `GET /runs/:runId/grade`.
- Create: `apps/api/src/routes/analysis.test.ts`
  Covers success and unknown-run behavior for the analysis route.
- Create: `apps/api/src/routes/grade.test.ts`
  Covers success and unknown-run behavior for the grade route.
- Modify: `apps/api/src/app.ts`
  Register the new read routes.
- Modify: `apps/api/src/routes/runs.test.ts`
  Keep the existing run-summary route green after stored run shape expands.

## Task 1: Add Domain Contracts For Analysis And Grade Assessment

**Files:**
- Create: `packages/domain/src/analysis.ts`
- Create: `packages/domain/src/grades.ts`
- Create: `packages/domain/src/analysis.test.ts`
- Create: `packages/domain/src/grades.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from "vitest";
import { agentGrades, failureClasses } from "./index.js";

describe("domain analysis and grade contracts", () => {
  it("exports the common grade ladder in order", () => {
    expect(agentGrades).toEqual(["Intern", "Junior", "Mid", "Senior", "Lead"]);
  });

  it("exports the supported failure taxonomy", () => {
    expect(failureClasses).toContain("observability");
    expect(failureClasses).toContain("safety");
  });
});
```

- [ ] **Step 2: Run contract tests to verify they fail**

Run: `pnpm vitest run packages/domain/src/analysis.test.ts packages/domain/src/grades.test.ts`
Expected: FAIL because the new contract modules and exports do not exist yet.

- [ ] **Step 3: Add `analysis.ts` with V1 diagnosis contracts**

```ts
export const failureClasses = [
  "goal_understanding",
  "decomposition",
  "tool_use",
  "recovery",
  "safety",
  "observability",
  "robustness",
  "efficiency"
] as const;

export interface RunAnalysis {
  readonly reportVersion: "v1";
  readonly runId: string;
  readonly scenarioId: string;
  readonly failurePatterns: readonly FailurePattern[];
  readonly suggestedChanges: readonly SuggestedChange[];
  readonly evidenceAnchors: readonly EvidenceAnchor[];
  readonly comparisonKeys: AnalysisComparisonKeys;
}
```

- [ ] **Step 4: Add `grades.ts` with the common ladder and grade artifact**

```ts
export const agentGrades = ["Intern", "Junior", "Mid", "Senior", "Lead"] as const;

export interface GradeAssessment {
  readonly assessmentVersion: "v1";
  readonly runId: string;
  readonly scenarioId: string;
  readonly recommendedGrade: AgentGrade;
  readonly authorizedScope: readonly AuthorizationScope[];
  readonly restrictedScope: readonly AuthorizationScope[];
  readonly promotionGaps: readonly PromotionGap[];
  readonly blockingIssues: readonly BlockingIssue[];
}
```

- [ ] **Step 5: Re-export the new contracts from `packages/domain/src/index.ts`**

```ts
export type {
  EvidenceAnchor,
  FailureClass,
  FailurePattern,
  RunAnalysis
} from "./analysis.js";

export { agentGrades } from "./grades.js";
export type { AgentGrade, GradeAssessment } from "./grades.js";
```

- [ ] **Step 6: Re-run the domain contract tests**

Run: `pnpm vitest run packages/domain/src/analysis.test.ts packages/domain/src/grades.test.ts`
Expected: PASS with the new contracts and exports available.

- [ ] **Step 7: Commit the domain contract slice**

```bash
git add packages/domain/src/analysis.ts packages/domain/src/grades.ts packages/domain/src/analysis.test.ts packages/domain/src/grades.test.ts packages/domain/src/index.ts
git commit -m "feat: add run analysis and grade contracts"
```

## Task 2: Build The Evidence And Failure Classification Layer

**Files:**
- Create: `packages/judge/src/evidence-extractor.ts`
- Create: `packages/judge/src/failure-classifier.ts`
- Create: `packages/judge/src/evidence-extractor.test.ts`
- Create: `packages/judge/src/failure-classifier.test.ts`
- Modify: `packages/judge/src/index.ts`

- [ ] **Step 1: Write failing tests for anchor extraction and failure classification**

```ts
import { describe, expect, it } from "vitest";
import { extractEvidenceAnchors, classifyFailurePatterns } from "./index.js";

describe("qualification evidence pipeline", () => {
  it("creates stable anchors from run events", () => {
    const anchors = extractEvidenceAnchors({
      runId: "run-0001",
      events: [{ type: "judge.update", summary: "Tool command failed." }],
      replayEvents: []
    });

    expect(anchors[0]?.anchorId).toBe("run-0001:event:0");
  });

  it("classifies an observability failure when blocker reporting is absent", () => {
    const patterns = classifyFailurePatterns({
      scenarioId: "scenario-1",
      judgeSummary: "No deterministic red lines were triggered.",
      findings: [],
      anchors: [{ anchorId: "a1", runId: "run-0001", summary: "Run ended abruptly." }]
    });

    expect(patterns[0]?.class).toBe("observability");
  });
});
```

- [ ] **Step 2: Run the new judge tests to verify they fail**

Run: `pnpm vitest run packages/judge/src/evidence-extractor.test.ts packages/judge/src/failure-classifier.test.ts`
Expected: FAIL because the evidence and classifier modules do not exist yet.

- [ ] **Step 3: Implement evidence extraction with stable anchor ids**

```ts
export function extractEvidenceAnchors(input: ExtractEvidenceAnchorsInput): EvidenceAnchor[] {
  return input.events.map((event, index) => ({
    anchorId: `${input.runId}:event:${index}`,
    runId: input.runId,
    eventType: event.type,
    eventIndex: index,
    summary: summarizeRunEvent(event)
  }));
}
```

- [ ] **Step 4: Implement deterministic failure classification**

```ts
export function classifyFailurePatterns(input: ClassifyFailurePatternsInput): FailurePattern[] {
  const patterns: FailurePattern[] = [];

  if (input.redLineTriggered) {
    patterns.push(buildSafetyPattern(input));
  }

  if (input.runOutcome === "errored") {
    patterns.push(buildRobustnessPattern(input));
  }

  return dedupePatterns(patterns);
}
```

- [ ] **Step 5: Export the new evidence and classifier helpers**

```ts
export { extractEvidenceAnchors } from "./evidence-extractor.js";
export { classifyFailurePatterns } from "./failure-classifier.js";
```

- [ ] **Step 6: Re-run the evidence and failure tests**

Run: `pnpm vitest run packages/judge/src/evidence-extractor.test.ts packages/judge/src/failure-classifier.test.ts`
Expected: PASS with deterministic anchors and failure patterns.

- [ ] **Step 7: Commit the evidence-classification slice**

```bash
git add packages/judge/src/evidence-extractor.ts packages/judge/src/failure-classifier.ts packages/judge/src/evidence-extractor.test.ts packages/judge/src/failure-classifier.test.ts packages/judge/src/index.ts
git commit -m "feat: add qualification evidence classification"
```

## Task 3: Generate RunAnalysis From Stored Evidence

**Files:**
- Create: `packages/judge/src/run-analysis.ts`
- Create: `packages/judge/src/run-analysis.test.ts`
- Modify: `packages/judge/src/index.ts`

- [ ] **Step 1: Write the failing `RunAnalysis` tests**

```ts
import { describe, expect, it } from "vitest";
import { analyzeRun } from "./index.js";

describe("analyzeRun", () => {
  it("builds a run analysis with evidence-backed suggestions", () => {
    const analysis = analyzeRun({
      runId: "run-0001",
      scenario: fixtureScenario(),
      events: fixtureEvents(),
      replay: fixtureReplay(),
      judge: fixtureJudge(),
      admission: fixtureAdmission(),
      measuredProfile: fixtureMeasuredProfile()
    });

    expect(analysis.failurePatterns.length).toBeGreaterThan(0);
    expect(analysis.suggestedChanges[0]?.targetsFailurePatterns.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the analysis tests to verify they fail**

Run: `pnpm vitest run packages/judge/src/run-analysis.test.ts`
Expected: FAIL because `analyzeRun(...)` does not exist yet.

- [ ] **Step 3: Implement `analyzeRun(...)` as the diagnosis aggregator**

```ts
export function analyzeRun(input: AnalyzeRunInput): RunAnalysis {
  const anchors = extractEvidenceAnchors({
    runId: input.runId,
    events: input.events,
    replayEvents: input.replay.events,
    findings: input.judge.findings
  });
  const failurePatterns = classifyFailurePatterns({
    scenarioId: input.scenario.scenarioId,
    runOutcome: readOutcome(input.measuredProfile),
    redLineTriggered: input.judge.redLineTriggered,
    findings: input.judge.findings,
    anchors
  });

  return {
    reportVersion: "v1",
    runId: input.runId,
    scenarioId: input.scenario.scenarioId,
    generatedAt: new Date().toISOString(),
    summary: buildAnalysisSummary(input, failurePatterns),
    capabilityInsights: buildCapabilityInsights(input.measuredProfile),
    failurePatterns,
    suggestedChanges: buildSuggestedChanges(failurePatterns),
    evidenceAnchors: anchors,
    confidence: "medium",
    comparisonKeys: buildAnalysisComparisonKeys(failurePatterns)
  };
}
```

- [ ] **Step 4: Export `analyzeRun(...)` from the judge package**

```ts
export { analyzeRun } from "./run-analysis.js";
export type { AnalyzeRunInput } from "./run-analysis.js";
```

- [ ] **Step 5: Re-run the analysis tests**

Run: `pnpm vitest run packages/judge/src/run-analysis.test.ts`
Expected: PASS with non-empty failure patterns, suggestions, and evidence anchors.

- [ ] **Step 6: Commit the run-analysis slice**

```bash
git add packages/judge/src/run-analysis.ts packages/judge/src/run-analysis.test.ts packages/judge/src/index.ts
git commit -m "feat: add run analysis generation"
```

## Task 4: Add Grade Evaluation And Persist It With Runs

**Files:**
- Create: `packages/judge/src/grade-evaluator.ts`
- Create: `packages/judge/src/grade-evaluator.test.ts`
- Modify: `packages/judge/src/index.ts`
- Modify: `packages/orchestrator/src/run-store.ts`
- Modify: `packages/orchestrator/src/finalize-run.ts`
- Modify: `packages/orchestrator/src/start-run.ts`
- Modify: `packages/orchestrator/src/start-run.test.ts`

- [ ] **Step 1: Write failing tests for grade evaluation and run persistence**

```ts
import { describe, expect, it } from "vitest";
import { evaluateGrade } from "../../judge/src/index.js";

describe("grade evaluation", () => {
  it("recommends Junior when safety is acceptable but recovery is weak", () => {
    const assessment = evaluateGrade({
      runAnalysis: fixtureAnalysis(),
      judge: fixtureJudge(),
      measuredProfile: fixtureMeasuredProfile()
    });

    expect(assessment.recommendedGrade).toBe("Junior");
    expect(assessment.promotionGaps[0]?.title).toContain("recovery");
  });
});
```

- [ ] **Step 2: Run the grade and orchestrator tests to verify they fail**

Run: `pnpm vitest run packages/judge/src/grade-evaluator.test.ts packages/orchestrator/src/start-run.test.ts`
Expected: FAIL because grade evaluation and stored-run persistence do not exist yet.

- [ ] **Step 3: Implement deterministic grade evaluation**

```ts
export function evaluateGrade(input: EvaluateGradeInput): GradeAssessment {
  const recommendedGrade = chooseGrade({
    redLineTriggered: input.judge.redLineTriggered,
    failurePatterns: input.runAnalysis.failurePatterns,
    measuredProfile: input.measuredProfile
  });

  return {
    assessmentVersion: "v1",
    runId: input.runAnalysis.runId,
    scenarioId: input.runAnalysis.scenarioId,
    recommendedGrade,
    gradeConfidence: "medium",
    authorizedScope: buildAuthorizedScope(recommendedGrade),
    restrictedScope: buildRestrictedScope(recommendedGrade, input.runAnalysis),
    promotionGaps: buildPromotionGaps(recommendedGrade, input.runAnalysis),
    blockingIssues: buildBlockingIssues(input.runAnalysis),
    supportingEvidence: collectSupportingEvidence(input.runAnalysis)
  };
}
```

- [ ] **Step 4: Persist `runAnalysis` and `gradeAssessment` in the orchestrator**

```ts
const runAnalysis = analyzeRun({ ... });
const gradeAssessment = evaluateGrade({
  runAnalysis,
  judge,
  measuredProfile: judge.measuredProfile
});

finalizeRun({
  ...,
  judge,
  runAnalysis,
  gradeAssessment
});
```

- [ ] **Step 5: Expand `StoredRun` and assert the new fields in tests**

```ts
expect(storedRun?.runAnalysis.failurePatterns.length).toBeGreaterThan(0);
expect(storedRun?.gradeAssessment.recommendedGrade).toBeDefined();
```

- [ ] **Step 6: Re-run the grade and orchestrator tests**

Run: `pnpm vitest run packages/judge/src/grade-evaluator.test.ts packages/orchestrator/src/start-run.test.ts`
Expected: PASS with grade recommendations and persisted artifacts.

- [ ] **Step 7: Commit the grade-evaluation slice**

```bash
git add packages/judge/src/grade-evaluator.ts packages/judge/src/grade-evaluator.test.ts packages/judge/src/index.ts packages/orchestrator/src/run-store.ts packages/orchestrator/src/finalize-run.ts packages/orchestrator/src/start-run.ts packages/orchestrator/src/start-run.test.ts
git commit -m "feat: add grade assessment persistence"
```

## Task 5: Expose Analysis And Grade Assessment Through API Routes

**Files:**
- Create: `apps/api/src/routes/analysis.ts`
- Create: `apps/api/src/routes/grade.ts`
- Create: `apps/api/src/routes/analysis.test.ts`
- Create: `apps/api/src/routes/grade.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/runs.test.ts`

- [ ] **Step 1: Write the failing API route tests**

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("analysis and grade routes", () => {
  it("serves persisted run analysis and grade assessment", async () => {
    const app = buildApp();
    const runId = await createFixtureRun(app);

    const analysisResponse = await app.inject({ method: "GET", url: `/runs/${runId}/analysis` });
    const gradeResponse = await app.inject({ method: "GET", url: `/runs/${runId}/grade` });

    expect(analysisResponse.statusCode).toBe(200);
    expect(gradeResponse.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `pnpm vitest run apps/api/src/routes/analysis.test.ts apps/api/src/routes/grade.test.ts apps/api/src/routes/runs.test.ts`
Expected: FAIL because the new routes are not registered yet.

- [ ] **Step 3: Add focused read routes for the new artifacts**

```ts
app.get("/runs/:runId/analysis", async (request, reply) => {
  const { runId } = request.params as { runId: string };
  const run = options.store.getRun(runId);
  if (!run) return reply.code(404).send({ message: `Unknown run: ${runId}` });
  return run.runAnalysis;
});
```

```ts
app.get("/runs/:runId/grade", async (request, reply) => {
  const { runId } = request.params as { runId: string };
  const run = options.store.getRun(runId);
  if (!run) return reply.code(404).send({ message: `Unknown run: ${runId}` });
  return run.gradeAssessment;
});
```

- [ ] **Step 4: Register the new routes in `apps/api/src/app.ts`**

```ts
registerAnalysisRoutes(app, { store });
registerGradeRoutes(app, { store });
```

- [ ] **Step 5: Re-run the API route tests**

Run: `pnpm vitest run apps/api/src/routes/analysis.test.ts apps/api/src/routes/grade.test.ts apps/api/src/routes/runs.test.ts`
Expected: PASS with dedicated analysis and grade responses and unchanged run-summary behavior.

- [ ] **Step 6: Run the full targeted verification set**

Run: `pnpm vitest run packages/domain/src/analysis.test.ts packages/domain/src/grades.test.ts packages/judge/src/evidence-extractor.test.ts packages/judge/src/failure-classifier.test.ts packages/judge/src/run-analysis.test.ts packages/judge/src/grade-evaluator.test.ts packages/orchestrator/src/start-run.test.ts apps/api/src/routes/analysis.test.ts apps/api/src/routes/grade.test.ts apps/api/src/routes/runs.test.ts`
Expected: PASS across the domain, judge, orchestrator, and API slices.

- [ ] **Step 7: Commit the API integration slice**

```bash
git add apps/api/src/routes/analysis.ts apps/api/src/routes/grade.ts apps/api/src/routes/analysis.test.ts apps/api/src/routes/grade.test.ts apps/api/src/app.ts apps/api/src/routes/runs.test.ts
git commit -m "feat: expose run analysis and grade routes"
```
