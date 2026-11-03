import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

// Checks on the files of the project itself, not on the code.

const root = process.cwd();

async function sourceFiles(folder: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(root, folder), { withFileTypes: true })) {
    const path = `${folder}/${entry.name}`;
    if (entry.isDirectory()) {
      found.push(...(await sourceFiles(path)));
    } else if (/\.(ts|tsx|css)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(join(root, path));
    return true;
  } catch {
    return false;
  }
}

test(".gitignore keeps the saved posts, the backups and the env files out of git", async () => {
  const lines = (await readFile(join(root, ".gitignore"), "utf8")).split("\n");
  expect(lines).toContain("/data/");
  expect(lines).toContain(".env*");
  expect(lines).toContain("/node_modules");
  expect(lines).toContain("/.next/");
  expect(lines.some((line) => /^\/?\.update-backup\/?$/.test(line))).toBe(true);
});

test(".gitignore does not hide the code, the tests or the tool", async () => {
  const lines = (await readFile(join(root, ".gitignore"), "utf8"))
    .split("\n")
    .map((line) => line.trim());
  for (const hidden of ["/app", "/lib", "/components", "/__tests__", "/scripts", "/public", "*.ts", "*.mjs"]) {
    expect(lines).not.toContain(hidden);
  }
});

test("the code only points to pictures that exist", async () => {
  const files = [
    ...(await sourceFiles("app")),
    ...(await sourceFiles("components")),
    ...(await sourceFiles("lib")),
  ];
  // Not a test of nothing: there are many files, and they are all read.
  expect(files.length).toBeGreaterThan(30);
  const pointers = /["'`]\/([A-Za-z0-9._-]+\.(?:svg|png|jpe?g|webp|gif|ico))["'`]/g;
  const missing: string[] = [];
  for (const file of files) {
    const text = await readFile(join(root, file), "utf8");
    for (const match of text.matchAll(pointers)) {
      const name = match[1];
      const there = (await exists(`public/${name}`)) || (await exists(`app/${name}`));
      if (there === false) missing.push(`${file} points to /${name}`);
    }
  }
  expect(missing).toEqual([]);
});

test("only one font is loaded, and nothing else asks for the font that was dropped", async () => {
  const layout = await readFile(join(root, "app", "layout.tsx"), "utf8");
  expect(layout).toContain("Geist");
  expect(layout).not.toContain("Geist_Mono");
  const css = await readFile(join(root, "app", "globals.css"), "utf8");
  expect(css).not.toContain("font-geist-mono");
});
