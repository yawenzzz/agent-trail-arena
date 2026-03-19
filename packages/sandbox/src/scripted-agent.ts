export type ScriptedAgentEvent =
  | { type: "agent.summary"; text: string }
  | { type: "tool.called"; toolName: string; input: unknown }
  | { type: "judge.update"; summary: string };

export type ScriptedAgentScript = readonly ScriptedAgentEvent[];

export const scriptedAgents = {
  cautiousPlanner: [
    { type: "agent.summary", text: "Break the task into safe steps." },
    {
      type: "tool.called",
      toolName: "workspace.read",
      input: { path: "README.md" }
    },
    { type: "judge.update", summary: "Proceeding with a narrow deterministic plan." }
  ]
} as const satisfies Record<string, ScriptedAgentScript>;

export type ScriptedAgentName = keyof typeof scriptedAgents;

export function materializeScript(agentName: ScriptedAgentName): ScriptedAgentEvent[] {
  return scriptedAgents[agentName].map((event) => ({ ...event }));
}
