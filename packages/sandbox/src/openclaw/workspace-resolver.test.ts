import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
  it("returns configured local agents from the OpenClaw state root", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");

    mkdirSync(join(stateRoot, "agents", "work"), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          agents: {
            defaults: {
              workspace: "~/trial-default-workspace"
            },
            list: [
              {
                id: "work",
                name: "Work Agent",
                workspace: "~/trial-work-agent"
              }
            ]
          }
        },
        null,
        2
      )
    );

    const result = await resolveOpenClawWorkspace({ stateRoot });

    expect(result.stateRoot).toBe(stateRoot);
    expect(result.configPath).toBe(configPath);
    expect(result.agents).toEqual([
      {
        agentId: "work",
        agentName: "Work Agent",
        definitionPath: configPath,
        workspaceRoot: "/Users/yawen.zheng/trial-work-agent"
      }
    ]);
  });

  it("returns the implicit main agent when no multi-agent config exists", async () => {
    const stateRoot = makeStateRoot();

    const result = await resolveOpenClawWorkspace({ stateRoot });

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

  it("rejects malformed OpenClaw config", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");
    writeFileSync(configPath, "{ broken json");

    await expect(resolveOpenClawWorkspace({ stateRoot })).rejects.toThrow(
      `Malformed OpenClaw config at ${configPath}`
    );
  });

  it("rejects duplicate configured agent ids", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");

    writeFileSync(
      configPath,
      JSON.stringify(
        {
          agents: {
            list: [
              { id: "dup-agent", workspace: "~/workspace-a" },
              { id: "dup-agent", workspace: "~/workspace-b" }
            ]
          }
        },
        null,
        2
      )
    );

    await expect(resolveOpenClawWorkspace({ stateRoot })).rejects.toThrow(
      `Duplicate OpenClaw agent id "dup-agent" found in config ${configPath}`
    );
  });

  it("keeps configured agent identifiers stable across repeated discovery", async () => {
    const stateRoot = makeStateRoot();
    const configPath = join(stateRoot, "openclaw.json");

    writeFileSync(
      configPath,
      JSON.stringify(
        {
          agents: {
            list: [{ id: "stable-agent", workspace: "~/stable-workspace" }]
          }
        },
        null,
        2
      )
    );

    const first = await resolveOpenClawWorkspace({ stateRoot });
    const second = await resolveOpenClawWorkspace({ stateRoot });

    expect(first.agents[0].agentId).toBe("stable-agent");
    expect(first.agents[0]).toEqual(second.agents[0]);
  });
});
