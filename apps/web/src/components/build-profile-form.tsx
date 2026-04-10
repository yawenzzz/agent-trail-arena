"use client";

import React from "react";

import type { FormEvent } from "react";
import { useState } from "react";
import type {
  AgentDescriptor,
  AgentProvider,
  AttributeName,
  ProviderAgentRuntimeTarget
} from "../lib/trial-types";
import {
  createDefaultAllocation,
  rebalanceAllocation,
  toDeclaredBuild,
  type BuildAllocation
} from "../lib/build-allocation";
import {
  createRun,
  provisionAgent,
  resolveAgents
} from "../lib/api-client";
import { resetProviderFormStateForSwitch } from "../lib/provider-form-state";
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
  runtime: ProviderAgentRuntimeTarget
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
  const [provider, setProvider] = useState<AgentProvider>("openclaw");
  const [stateRoot, setStateRoot] = useState("");
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [agents, setAgents] = useState<readonly AgentDescriptor[]>([]);
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

  function handleProviderChange(nextProvider: AgentProvider) {
    const nextState = resetProviderFormStateForSwitch({
      nextProvider,
      state: {
        provider,
        stateRoot,
        workspaceRoot,
        agents,
        selectedAgentId,
        workspaceError
      }
    });

    setProvider(nextState.provider);
    setStateRoot(nextState.stateRoot);
    setWorkspaceRoot(nextState.workspaceRoot);
    setAgents(nextState.agents);
    setSelectedAgentId(nextState.selectedAgentId);
    setWorkspaceError(nextState.workspaceError);
  }

  async function handleResolveWorkspace() {
    setWorkspaceError(null);
    setIsResolving(true);

    try {
      const resolved =
        provider === "openclaw"
          ? await resolveAgents({
              provider: "openclaw",
              stateRoot
            })
          : await resolveAgents({
              provider: "codex",
              workspaceRoot
            });

      if (resolved.provider === "openclaw") {
        setStateRoot(resolved.stateRoot);
      } else {
        setWorkspaceRoot(resolved.workspaceRoot);
      }
      setAgents(resolved.agents);
      setSelectedAgentId("");
    } catch (resolutionError) {
      setWorkspaceError(
        resolutionError instanceof Error
          ? resolutionError.message
          : `Failed to resolve ${provider === "openclaw" ? "OpenClaw" : "Codex"} workspace.`
      );
    } finally {
      setIsResolving(false);
    }
  }

  async function handleCreateAgent() {
    setWorkspaceError(null);
    setIsProvisioning(true);

    try {
      const agent =
        provider === "openclaw"
          ? await provisionAgent({
              provider: "openclaw",
              stateRoot,
              agentName: createAgentName
            })
          : await provisionAgent({
              provider: "codex",
              workspaceRoot,
              agentName: createAgentName
            });

      setAgents([agent]);
      setSelectedAgentId(agent.agentId);
    } catch (provisionError) {
      setWorkspaceError(
        provisionError instanceof Error
          ? provisionError.message
          : `Failed to create ${provider === "openclaw" ? "OpenClaw" : "Codex"} agent.`
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
          kind: "provider-agent",
          provider,
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

      <label className="field">
        <span>Runtime provider</span>
        <select
          aria-label="Runtime provider"
          name="provider"
          onChange={(event) => handleProviderChange(event.target.value as AgentProvider)}
          value={provider}
        >
          <option value="openclaw">OpenClaw</option>
          <option value="codex">Codex</option>
        </select>
      </label>

      {provider === "openclaw" ? (
        <>
          <OpenClawWorkspacePanel
            error={workspaceError}
            isResolving={isResolving}
            onResolve={handleResolveWorkspace}
            onStateRootChange={setStateRoot}
            stateRoot={stateRoot}
          />

          <OpenClawAgentPicker
            agents={agents.filter(
              (agent): agent is Extract<AgentDescriptor, { provider: "openclaw" }> =>
                agent.provider === "openclaw"
            )}
            createAgentName={createAgentName}
            error={workspaceError}
            isProvisioning={isProvisioning}
            onCreateAgent={handleCreateAgent}
            onCreateAgentNameChange={setCreateAgentName}
            onSelectAgent={setSelectedAgentId}
            selectedAgentId={selectedAgentId}
          />
        </>
      ) : (
        <>
          <section className="panel stack-sm">
            <div className="stack-sm">
              <p className="eyebrow">Codex Workspace</p>
              <h2>Resolve Codex agents</h2>
              <p className="muted">
                Load Codex agent presets from the workspace-local Trial Arena metadata file.
              </p>
            </div>

            <label className="field">
              <span>Workspace root</span>
              <input
                name="workspaceRoot"
                onChange={(event) => setWorkspaceRoot(event.target.value)}
                placeholder="~/project"
                value={workspaceRoot}
              />
            </label>

            <div className="actions">
              <button
                className="secondary-button"
                disabled={isResolving}
                onClick={() => void handleResolveWorkspace()}
                type="button"
              >
                {isResolving ? "Loading..." : "Load Codex agents"}
              </button>
              {workspaceError ? <p className="error-text">{workspaceError}</p> : null}
            </div>
          </section>

          {agents.length > 0 ? (
            <section className="panel stack-sm">
              <div className="stack-sm">
                <p className="eyebrow">Agent Selection</p>
                <h2>Choose a Codex agent</h2>
                <p className="muted">Trial Arena found Codex presets for this workspace.</p>
              </div>

              <label className="field">
                <span>Agent name</span>
                <select
                  name="codexAgentId"
                  onChange={(event) => setSelectedAgentId(event.target.value)}
                  value={selectedAgentId}
                >
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.agentName}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : (
            <section className="panel stack-sm">
              <div className="stack-sm">
                <p className="eyebrow">Agent Provisioning</p>
                <h2>No Codex agents found</h2>
                <p className="muted">
                  Create a Codex agent preset so this workspace can be tested in Trial Arena.
                </p>
              </div>

              <label className="field">
                <span>Agent name</span>
                <input
                  name="createAgentName"
                  onChange={(event) => setCreateAgentName(event.target.value)}
                  placeholder="trial-agent"
                  value={createAgentName}
                />
              </label>

              <div className="actions">
                <button
                  className="secondary-button"
                  disabled={isProvisioning || createAgentName.trim().length === 0}
                  onClick={() => void handleCreateAgent()}
                  type="button"
                >
                  {isProvisioning ? "Creating..." : "Create agent"}
                </button>
                {workspaceError ? <p className="error-text">{workspaceError}</p> : null}
              </div>
            </section>
          )}
        </>
      )}

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
