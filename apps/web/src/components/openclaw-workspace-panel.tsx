"use client";

import React from "react";

interface OpenClawWorkspacePanelProps {
  readonly stateRoot: string;
  readonly isResolving: boolean;
  readonly error: string | null;
  readonly onStateRootChange: (value: string) => void;
  readonly onResolve: () => Promise<void> | void;
}

export function OpenClawWorkspacePanel(props: OpenClawWorkspacePanelProps) {
  return (
    <section className="panel stack-sm">
      <div className="stack-sm">
        <p className="eyebrow">OpenClaw State</p>
        <h2>Resolve local agents</h2>
        <p className="muted">
          Load agents from your local OpenClaw state directory. Leave this blank to use
          the default <code>~/.openclaw</code> location.
        </p>
      </div>

      <label className="field">
        <span>State root override</span>
        <input
          name="stateRoot"
          onChange={(event) => props.onStateRootChange(event.target.value)}
          placeholder="~/.openclaw"
          value={props.stateRoot}
        />
      </label>

      <div className="actions">
        <button
          className="secondary-button"
          disabled={props.isResolving}
          onClick={() => void props.onResolve()}
          type="button"
        >
          {props.isResolving ? "Loading..." : "Load local agents"}
        </button>
        {props.error ? <p className="error-text">{props.error}</p> : null}
      </div>
    </section>
  );
}
