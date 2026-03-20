"use client";

import React from "react";

import type { OpenClawAgentDescriptor } from "../lib/trial-types";

interface OpenClawAgentPickerProps {
  readonly agents: readonly OpenClawAgentDescriptor[];
  readonly selectedAgentId: string;
  readonly createAgentName: string;
  readonly isProvisioning: boolean;
  readonly error: string | null;
  readonly onSelectAgent: (agentId: string) => void;
  readonly onCreateAgentNameChange: (value: string) => void;
  readonly onCreateAgent: () => Promise<void> | void;
}

export function OpenClawAgentPicker(props: OpenClawAgentPickerProps) {
  if (props.agents.length > 0) {
    return (
      <section className="panel stack-sm">
        <div className="stack-sm">
          <p className="eyebrow">Agent Selection</p>
          <h2>Choose an OpenClaw agent</h2>
          <p className="muted">
            Trial Arena found local agent definitions. Pick which one to test.
          </p>
        </div>

        <label className="field">
          <span>Agent name</span>
          <select
            name="openclawAgentId"
            onChange={(event) => props.onSelectAgent(event.target.value)}
            value={props.selectedAgentId}
          >
            <option value="">Select an agent</option>
            {props.agents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.agentName}
              </option>
            ))}
          </select>
        </label>

        {props.error ? <p className="error-text">{props.error}</p> : null}
      </section>
    );
  }

  return (
    <section className="panel stack-sm">
      <div className="stack-sm">
        <p className="eyebrow">Agent Provisioning</p>
        <h2>No local agents found</h2>
        <p className="muted">
          Create a minimal OpenClaw agent definition so this workspace can be tested.
        </p>
      </div>

      <label className="field">
        <span>Agent name</span>
        <input
          name="createAgentName"
          onChange={(event) => props.onCreateAgentNameChange(event.target.value)}
          placeholder="trial-agent"
          value={props.createAgentName}
        />
      </label>

      <div className="actions">
        <button
          className="secondary-button"
          disabled={props.isProvisioning || props.createAgentName.trim().length === 0}
          onClick={() => void props.onCreateAgent()}
          type="button"
        >
          {props.isProvisioning ? "Creating..." : "Create agent"}
        </button>
        {props.error ? <p className="error-text">{props.error}</p> : null}
      </div>
    </section>
  );
}
