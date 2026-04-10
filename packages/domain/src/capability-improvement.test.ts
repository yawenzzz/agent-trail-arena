import { describe, expect, it } from "vitest";
import type {
  ImprovementCandidate,
  ProductionLearningRecord,
  ProductionTraceRecord
} from "./index.js";
import {
  approvalRequiredChangeSurfaces,
  autoPromotableChangeSurfaces,
  candidateTouchesApprovalRequiredSurface,
  changeSurfaces,
  isAutoPromotableChangeSurface
} from "./index.js";

describe("capability improvement contracts", () => {
  it("defines the approved v1 surface split", () => {
    expect(changeSurfaces).toEqual([
      "prompt",
      "memory",
      "knowledge",
      "tool_permissions",
      "safety_policy"
    ]);
    expect(autoPromotableChangeSurfaces).toEqual([
      "prompt",
      "memory",
      "knowledge"
    ]);
    expect(approvalRequiredChangeSurfaces).toEqual([
      "tool_permissions",
      "safety_policy"
    ]);
  });

  it("identifies auto-promotable vs approval-required surfaces", () => {
    expect(isAutoPromotableChangeSurface("prompt")).toBe(true);
    expect(isAutoPromotableChangeSurface("memory")).toBe(true);
    expect(isAutoPromotableChangeSurface("tool_permissions")).toBe(false);
  });

  it("detects approval-required candidate changes", () => {
    const promotableCandidate: ImprovementCandidate = {
      candidateId: "candidate-1",
      createdAt: "2026-04-07T08:00:00.000Z",
      status: "draft",
      rationale: "Clarify retry behavior.",
      linkedLearningRecordIds: ["learning-1"],
      linkedEvalArtifactIds: ["artifact-1"],
      approvalRequired: false,
      changes: [
        {
          surface: "prompt",
          summary: "Clarify retry behavior.",
          diff: "+ Retry transient workspace read failures once."
        }
      ]
    };
    const blockedCandidate: ImprovementCandidate = {
      ...promotableCandidate,
      candidateId: "candidate-2",
      approvalRequired: true,
      changes: [
        ...promotableCandidate.changes,
        {
          surface: "tool_permissions",
          summary: "Allow shell escalation.",
          diff: "+ shell.exec:*"
        }
      ]
    };

    expect(candidateTouchesApprovalRequiredSurface(promotableCandidate)).toBe(false);
    expect(candidateTouchesApprovalRequiredSurface(blockedCandidate)).toBe(true);
  });

  it("models production traces and learning records with replay evidence", () => {
    const trace: ProductionTraceRecord = {
      traceId: "trace-1",
      bundleVersionId: "bundle-v1",
      userRequest: "Finish the workspace task safely.",
      agentMessages: [{ messageId: "assistant-1", text: "Attempting safe recovery." }],
      toolCalls: [],
      userCorrections: [
        {
          correctionId: "correction-1",
          summary: "Do not retry the same failing command twice."
        }
      ],
      signals: {
        humanTakeover: false,
        interrupted: true,
        retryCount: 2,
        stuck: false
      },
      terminalOutcome: {
        status: "failed",
        summary: "The agent repeated a failed retry loop."
      },
      replayEvents: [{ type: "agent.summary", text: "Attempting safe recovery." }],
      evidenceAnchors: [],
      capturedAt: "2026-04-07T08:00:00.000Z"
    };
    const learningRecord: ProductionLearningRecord = {
      learningRecordId: "learning-1",
      traceId: trace.traceId,
      createdAt: "2026-04-07T08:01:00.000Z",
      issueClass: "recovery",
      evidenceAnchors: [
        {
          anchorId: "trace-1:event:0",
          runId: trace.traceId,
          eventType: "agent.summary",
          eventIndex: 0,
          summary: "Attempting safe recovery."
        }
      ],
      rootCauseHypothesis: "The agent repeated a failed retry loop.",
      recoveryBehavior: "Recovery degraded after a correction.",
      userCorrectionSummary: "Do not retry the same failing command twice.",
      recommendedChangeType: "knowledge"
    };

    expect(trace.bundleVersionId).toBe("bundle-v1");
    expect(learningRecord.recommendedChangeType).toBe("knowledge");
    expect(learningRecord.evidenceAnchors[0]?.runId).toBe(trace.traceId);
  });
});
