import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function prepareNextServerArtifacts(rootDir = process.cwd()) {
  const serverDir = path.join(rootDir, ".next", "server");
  const chunksDir = path.join(serverDir, "chunks");

  let chunkEntries;
  try {
    chunkEntries = await readdir(chunksDir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  await mkdir(serverDir, { recursive: true });

  for (const entry of chunkEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const sourcePath = path.join(chunksDir, entry.name);
    const targetPath = path.join(serverDir, entry.name);

    const targetStats = await stat(targetPath).catch(() => null);
    const sourceStats = await stat(sourcePath);

    if (targetStats && targetStats.mtimeMs >= sourceStats.mtimeMs) {
      continue;
    }

    await copyFile(sourcePath, targetPath);
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await prepareNextServerArtifacts(path.resolve(import.meta.dirname, ".."));
}
