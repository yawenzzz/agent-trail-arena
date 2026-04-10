export function normalizeCodexAgentId(agentName: string): string {
  const normalized = agentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (
    normalized.length === 0 ||
    normalized.length > 64 ||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(normalized)
  ) {
    throw new Error(`Invalid Codex agent name "${agentName}".`);
  }

  return normalized;
}
