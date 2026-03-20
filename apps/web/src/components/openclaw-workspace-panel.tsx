"use client";

import React from "react";

interface OpenClawWorkspacePanelProps {
  readonly workspaceRoot: string;
  readonly isResolving: boolean;
  readonly error: string | null;
  readonly onWorkspaceRootChange: (value: string) => void;
  readonly onResolve: () => Promise<void> | void;
}

export function OpenClawWorkspacePanel(props: OpenClawWorkspacePanelProps) {
  return (
    <section className="panel stack-sm">
      <div className="stack-sm">
        <p className="eyebrow">OpenClaw Workspace</p>
        <h2>Resolve local agents</h2>
        <p className="muted">
          Point Trial Arena at an OpenClaw working directory root. The app will inspect
          its <code>.openclaw</code> state before letting you start a run.
        </p>
      </div>

      <label className="field">
        <span>Workspace root</span>
        <input
          name="workspaceRoot"
          onChange={(event) => props.onWorkspaceRootChange(event.target.value)}
          placeholder="/path/to/openclaw-workspace"
          value={props.workspaceRoot}
        />
      </label>

      <div className="actions">
        <button
          className="secondary-button"
          disabled={props.isResolving || props.workspaceRoot.trim().length === 0}
          onClick={() => void props.onResolve()}
          type="button"
        >
          {props.isResolving ? "Loading..." : "Load agents"}
        </button>
        {props.error ? <p className="error-text">{props.error}</p> : null}
      </div>
    </section>
  );
}
