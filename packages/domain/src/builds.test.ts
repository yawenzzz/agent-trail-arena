import { describe, expect, it } from "vitest";
import { workspaceReady } from "@openclaw/domain";

describe("workspace", () => {
  it("loads shared packages", () => {
    expect(workspaceReady).toBe(true);
  });
});
