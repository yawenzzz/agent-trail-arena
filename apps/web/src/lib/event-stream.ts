import type { RunEvent } from "./trial-types";

export function parseSseEvents(streamText: string): readonly RunEvent[] {
  return streamText
    .trim()
    .split("\n\n")
    .flatMap((chunk) => {
      const dataLine = chunk
        .split("\n")
        .find((line) => line.startsWith("data: "));

      if (!dataLine) {
        return [];
      }

      return [JSON.parse(dataLine.slice(6)) as RunEvent];
    });
}
