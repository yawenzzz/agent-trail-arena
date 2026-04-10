export const attributeLevels = ["low", "medium", "high"] as const;

export type AttributeName =
  | "planning"
  | "execution"
  | "toolProficiency"
  | "recovery"
  | "efficiency"
  | "correctness"
  | "robustness"
  | "safetyDiscipline"
  | "costAwareness"
  | "observability";

export type AttributeLevel = (typeof attributeLevels)[number];
export type DeclaredBuild = Partial<Record<AttributeName, AttributeLevel>>;

export type ScenarioType = "standard" | "workflow";
export type ScenarioOutcome = "passed" | "failed" | "errored";

export interface ScenarioDefinition {
  readonly scenarioId: string;
  readonly title: string;
  readonly type: ScenarioType;
  readonly goal: string;
  readonly allowedTools: readonly string[];
  readonly environmentConstraints: readonly string[];
  readonly expectedArtifacts: readonly string[];
  readonly targetedAttributes: readonly AttributeName[];
  readonly redLines: readonly string[];
  readonly defaultScoreDimensions: readonly string[];
  readonly supportedJudges: readonly string[];
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly scenarioType: ScenarioType;
  readonly outcome: ScenarioOutcome;
  readonly summary: string;
  readonly score?: number;
  readonly notes?: readonly string[];
}

export type RunEvent =
  | { type: "run.started"; runId: string; scenarioId: string }
  | { type: "agent.summary"; text: string }
  | { type: "tool.called"; toolName: string; input: unknown }
  | { type: "judge.update"; summary: string }
  | { type: "run.completed"; result: ScenarioResult };

export type JudgeSeverity = "info" | "warning" | "critical";

export interface JudgeFinding {
  readonly code: string;
  readonly message: string;
  readonly severity: JudgeSeverity;
  readonly evidence?: readonly string[];
}

export interface JudgeResult {
  readonly summary: string;
  readonly findings: readonly JudgeFinding[];
  readonly redLineTriggered: boolean;
}

export interface MeasuredProfile {
  readonly attributes: Partial<Record<AttributeName, number>>;
  readonly scenarioResults: readonly ScenarioResult[];
}

export type AdmissionStatus =
  | "production-ready"
  | "limited-scope-trial"
  | "needs-tuning-and-retest"
  | "not-allowed-for-production";

export interface AdmissionResult {
  readonly status: AdmissionStatus;
  readonly explanation: string;
}

export interface OpenClawAgentDescriptor {
  readonly agentId: string;
  readonly agentName: string;
  readonly definitionPath: string;
  readonly workspaceRoot: string;
}

export interface ResolvedOpenClawWorkspace {
  readonly stateRoot: string;
  readonly configPath: string;
  readonly agents: readonly OpenClawAgentDescriptor[];
}

export type AgentProvider = "openclaw" | "codex";

export interface CodexAgentDescriptor {
  readonly provider: "codex";
  readonly agentId: string;
  readonly agentName: string;
  readonly workspaceRoot: string;
  readonly definitionPath?: string;
}

export interface OpenClawProviderAgentDescriptor extends OpenClawAgentDescriptor {
  readonly provider: "openclaw";
}

export type AgentDescriptor = OpenClawProviderAgentDescriptor | CodexAgentDescriptor;

export interface ResolvedCodexWorkspace {
  readonly provider: "codex";
  readonly workspaceRoot: string;
  readonly agents: readonly CodexAgentDescriptor[];
}

export interface ResolvedOpenClawProviderWorkspace extends ResolvedOpenClawWorkspace {
  readonly provider: "openclaw";
  readonly agents: readonly OpenClawProviderAgentDescriptor[];
}

export type ResolvedAgentWorkspace =
  | ResolvedOpenClawProviderWorkspace
  | ResolvedCodexWorkspace;

export interface OpenClawRuntimeTarget {
  readonly kind: "openclaw";
  readonly workspaceRoot: string;
  readonly agentId: string;
}

export interface ProviderAgentRuntimeTarget {
  readonly kind: "provider-agent";
  readonly provider: AgentProvider;
  readonly workspaceRoot: string;
  readonly agentId: string;
}

export type RunRequestRuntime =
  | { readonly kind: "scripted"; readonly agentName: string }
  | ProviderAgentRuntimeTarget;
