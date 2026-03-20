import type { RunEvent } from "../../../../packages/domain/src/events.js";

export function formatSseEvent(event: RunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
