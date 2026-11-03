import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach } from "vitest";

// Tests that write real files work in a folder inside node_modules, which git
// and the test watcher both ignore. Call this once at the top of a test file.
// It gives back a function that makes a fresh folder, and after each test it
// removes every folder that it made itself.
export function useTempFolders(prefix: string): () => Promise<string> {
  const testRoot = join(
    process.cwd(),
    "node_modules",
    ".cache",
    "post-store-tests",
  );
  const made: string[] = [];

  afterEach(async () => {
    while (made.length > 0) {
      const folder = made.pop();
      if (typeof folder === "string" && folder.startsWith(testRoot + "/")) {
        await rm(folder, { recursive: true, force: true });
      }
    }
  });

  return async () => {
    await mkdir(testRoot, { recursive: true });
    const folder = await mkdtemp(join(testRoot, prefix));
    made.push(folder);
    return folder;
  };
}
