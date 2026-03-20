import React from "react";
import type { AdmissionResult, JudgeResult, MeasuredProfile } from "../lib/trial-types";

interface JudgePanelProps {
  readonly judge: JudgeResult;
  readonly admission: AdmissionResult;
  readonly measuredProfile: MeasuredProfile;
}

export function JudgePanel({ judge, admission, measuredProfile }: JudgePanelProps) {
  return (
    <section className="panel stack-md">
      <p className="eyebrow">Judge Panel</p>
      <h2>{admission.status}</h2>
      <p className="muted">{admission.explanation}</p>
      <p>{judge.summary}</p>
      <div className="chip-row">
        {Object.entries(measuredProfile.attributes).map(([attribute, score]) => (
          <span className="chip" key={attribute}>
            {attribute}: {score}
          </span>
        ))}
      </div>
      <ul className="finding-list">
        {judge.findings.length === 0 ? <li>No deterministic findings.</li> : null}
        {judge.findings.map((finding) => (
          <li key={finding.code}>
            {finding.severity}: {finding.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
