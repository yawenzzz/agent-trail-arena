import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { resolveOpenClawWorkspace } from "./workspace-resolver.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

function makeStateRoot(): string {
  const stateRoot = mkdtempSync(join(tmpdir(), "openclaw-state-"));
  tempDirs.push(stateRoot);
  return stateRoot;
}

describe("resolveOpenClawWorkspace", () => {
  it("returns discovered local agents from the OpenClaw state root", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");
    const listAgents = vi.fn().mockResolvedValue([
      {
        id: "work",
        name: "Work Agent",
        workspace: "~/trial-work-agent"
      }
    ]);

    const result = await resolveOpenClawWorkspace({ stateRoot, listAgents });

    expect(listAgents).toHaveBeenCalledWith({
      stateRoot,
      configPath
    });
    expect(result.stateRoot).toBe(stateRoot);
    expect(result.configPath).toBe(configPath);
    expect(result.agents).toEqual([
      {
        agentId: "work",
        agentName: "Work Agent",
        definitionPath: configPath,
        workspaceRoot: join(homedir(), "trial-work-agent")
      }
    ]);
  });

  it("returns the implicit main agent when discovery is empty", async () => {
    const stateRoot = makeStateRoot();

    const result = await resolveOpenClawWorkspace({
      stateRoot,
      listAgents: vi.fn().mockResolvedValue([])
    });

    expect(result).toEqual({
      stateRoot,
      configPath: join(stateRoot, "openclaw.json"),
      agents: [
        {
          agentId: "main",
          agentName: "main",
          definitionPath: join(stateRoot, "openclaw.json"),
          workspaceRoot: join(stateRoot, "workspace")
        }
      ]
    });
  });

  it("rejects state roots that do not exist", async () => {
    await expect(
      resolveOpenClawWorkspace({ stateRoot: "/tmp/openclaw-state-missing" })
    ).rejects.toThrow(
      "OpenClaw state root does not exist or is not a directory: /tmp/openclaw-state-missing"
    );
  });

  it("rejects malformed discovery payloads", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");

    await expect(
      resolveOpenClawWorkspace({
        stateRoot,
        listAgents: vi.fn().mockResolvedValue([{ workspace: "~/missing-id" }])
      })
    ).rejects.toThrow(
      `Malformed OpenClaw agent discovery for ${configPath}: entry 0 is missing a non-empty string id`
    );
  });

  it("rejects duplicate discovered agent ids", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");

    await expect(
      resolveOpenClawWorkspace({
        stateRoot,
        listAgents: vi.fn().mockResolvedValue([
          { id: "dup-agent", workspace: "~/workspace-a" },
          { id: "dup-agent", workspace: "~/workspace-b" }
        ])
      })
    ).rejects.toThrow(
      `Duplicate OpenClaw agent id "dup-agent" found in config ${configPath}`
    );
  });

  it("keeps discovered agent identifiers stable across repeated discovery", async () => {
    const stateRoot = makeStateRoot();
    mkdirSync(stateRoot, { recursive: true });
    const listAgents = vi.fn().mockResolvedValue([
      { id: "stable-agent", workspace: "~/stable-workspace" }
    ]);

    const first = await resolveOpenClawWorkspace({ stateRoot, listAgents });
    const second = await resolveOpenClawWorkspace({ stateRoot, listAgents });

    expect(first.agents[0].agentId).toBe("stable-agent");
    expect(first.agents[0]).toEqual(second.agents[0]);
  });
});
