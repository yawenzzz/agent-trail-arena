"use client";

import React from "react";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  AttributeName,
  OpenClawAgentDescriptor,
  OpenClawRuntimeTarget
} from "../lib/trial-types";
import {
  createDefaultAllocation,
  rebalanceAllocation,
  toDeclaredBuild,
  type BuildAllocation
} from "../lib/build-allocation";
import {
  createRun,
  provisionOpenClawAgent,
  resolveOpenClawWorkspace
} from "../lib/api-client";
import { AllocationBar } from "./allocation-bar";
import { BuildRadarChart } from "./build-radar-chart";
import { BuildSummary } from "./build-summary";
import { OpenClawAgentPicker } from "./openclaw-agent-picker";
import { OpenClawWorkspacePanel } from "./openclaw-workspace-panel";

const coreAttributes = [
  "planning",
  "execution",
  "toolProficiency",
  "recovery",
  "robustness",
  "safetyDiscipline"
] as const satisfies readonly AttributeName[];

const advancedAttributes = [
  "efficiency",
  "correctness",
  "costAwareness",
  "observability"
] as const satisfies readonly AttributeName[];

const attributeLabels: Record<AttributeName, string> = {
  planning: "Planning",
  execution: "Execution",
  toolProficiency: "Tool proficiency",
  recovery: "Recovery",
  efficiency: "Efficiency",
  correctness: "Correctness",
  robustness: "Robustness",
  safetyDiscipline: "Safety discipline",
  costAwareness: "Cost awareness",
  observability: "Observability"
};

export function handleAllocationChange(
  allocation: BuildAllocation,
  attribute: AttributeName,
  value: number
): BuildAllocation {
  return rebalanceAllocation(allocation, attribute, value);
}

export function createRunRequest(
  allocation: BuildAllocation,
  agentVersion: string,
  runtime: OpenClawRuntimeTarget
) {
  return {
    agentVersion,
    build: toDeclaredBuild(allocation),
    judgeConfigVersion: "judge-v1",
    seed: "seed-123",
    runtime
  };
}

export function BuildProfileForm() {
  const [allocation, setAllocation] = useState<BuildAllocation>(() => createDefaultAllocation());
  const [stateRoot, setStateRoot] = useState("");
  const [agents, setAgents] = useState<readonly OpenClawAgentDescriptor[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [createAgentName, setCreateAgentName] = useState("trial-agent");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAllocation(attribute: AttributeName, value: number) {
    setAllocation((current) => handleAllocationChange(current, attribute, value));
  }

  async function handleResolveWorkspace() {
    setWorkspaceError(null);
    setIsResolving(true);

    try {
      const resolved = await resolveOpenClawWorkspace({
        stateRoot
      });

      setStateRoot(resolved.stateRoot);
      setAgents(resolved.agents);
      setSelectedAgentId("");
    } catch (resolutionError) {
      setWorkspaceError(
        resolutionError instanceof Error
          ? resolutionError.message
          : "Failed to resolve OpenClaw workspace."
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function handleCreateAgent() {
    setWorkspaceError(null);
    setIsProvisioning(true);

    try {
      const agent = await provisionOpenClawAgent({
        stateRoot,
        agentName: createAgentName
      });

      setAgents([agent]);
      setSelectedAgentId(agent.agentId);
    } catch (provisionError) {
      setWorkspaceError(
        provisionError instanceof Error
          ? provisionError.message
          : "Failed to create OpenClaw agent."
      );
    } finally {
      setIsProvisioning(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const agentVersion = String(formData.get("agentVersion") ?? "agent-v1");
    const selectedAgent = agents.find((agent) => agent.agentId === selectedAgentId);

    try {
      if (!selectedAgent) {
        throw new Error("Select an OpenClaw agent before starting the trial.");
      }

      const run = await createRun(
        createRunRequest(allocation, agentVersion, {
          kind: "openclaw",
          workspaceRoot: selectedAgent.workspaceRoot,
          agentId: selectedAgent.agentId
        })
      );

      window.location.assign(`/arena/${run.runId}`);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Failed to start trial."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel stack-lg" onSubmit={handleSubmit}>
      <div className="stack-sm">
        <p className="eyebrow">Build Setup</p>
        <h1>Define the declared build</h1>
        <p className="muted">
          Pick the tendencies this agent claims. The arena will tailor the trial and admission bar.
        </p>
      </div>

      <label className="field">
        <span>Agent version</span>
        <input defaultValue="agent-v1" name="agentVersion" />
      </label>

      <OpenClawWorkspacePanel
        error={workspaceError}
        isResolving={isResolving}
        onResolve={handleResolveWorkspace}
        onStateRootChange={setStateRoot}
        stateRoot={stateRoot}
      />

      <OpenClawAgentPicker
        agents={agents}
        createAgentName={createAgentName}
        error={workspaceError}
        isProvisioning={isProvisioning}
        onCreateAgent={handleCreateAgent}
        onCreateAgentNameChange={setCreateAgentName}
        onSelectAgent={setSelectedAgentId}
        selectedAgentId={selectedAgentId}
      />

      <div className="stack-md">
        <section className="panel stack-md">
          <div className="stack-sm">
            <p className="eyebrow">Control Console</p>
            <h2>100 pts budget</h2>
            <p className="muted">
              The declared build is expressed as allocation bars for the trial controller.
            </p>
          </div>

          <div className="stack-sm">
            {coreAttributes.map((attribute) => (
              <AllocationBar
                key={attribute}
                label={attributeLabels[attribute]}
                onChange={(value) => updateAllocation(attribute, value)}
                value={allocation[attribute]}
              />
            ))}
          </div>

          <details>
            <summary>Advanced allocation</summary>
            <div className="stack-sm">
              {advancedAttributes.map((attribute) => (
                <AllocationBar
                  key={attribute}
                  label={attributeLabels[attribute]}
                  onChange={(value) => updateAllocation(attribute, value)}
                  value={allocation[attribute]}
                />
              ))}
            </div>
          </details>
        </section>

        <div className="stack-md">
          <BuildRadarChart allocation={allocation} />
          <BuildSummary allocation={allocation} />
        </div>
      </div>

      <div className="actions">
        <button
          className="primary-button"
          disabled={isSubmitting || selectedAgentId.length === 0}
          type="submit"
        >
          {isSubmitting ? "Starting..." : "Start trial"}
        </button>
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </form>
  );
}
