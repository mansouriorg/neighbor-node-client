import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";

// Checks on the style sheet itself. A color or a shadow that a class asks for
// but nobody defined would show as nothing at all, and nothing would say so.
const root = process.cwd();

async function css(): Promise<string> {
  return readFile(join(root, "app", "globals.css"), "utf8");
}

// The text between the braces that follow the first match of a selector.
function blockOf(text: string, selector: string, from = 0): string {
  const start = text.indexOf(selector, from);
  expect(start > -1).toBe(true);
  const open = text.indexOf("{", start);
  const close = text.indexOf("}", open);
  return text.slice(open + 1, close);
}

function namesDefinedIn(block: string): string[] {
  return Array.from(block.matchAll(/(--[a-z-]+):/g)).map((match) => match[1]);
}

test("the dark colors define every name that the light colors define, and the other way round", async () => {
  const source = await css();
  const light = namesDefinedIn(blockOf(source, ":root {")).sort();
  const dark = namesDefinedIn(blockOf(source, "@media (prefers-color-scheme: dark)")).sort();
  expect(light.length).toBeGreaterThan(15);
  expect(dark).toEqual(light);
  for (const name of ["--glow", "--card-shadow", "--lift-shadow"]) {
    expect(light.includes(name)).toBe(true);
  }
});

test("every variable the page asks for with var() is defined somewhere", async () => {
  const source = await css();
  const defined = new Set(namesDefinedIn(source));
  const asked = new Set(Array.from(source.matchAll(/var\((--[a-z-]+)/g)).map((match) => match[1]));
  // The name of the font is made by Next.js when the page is built.
  const missing = Array.from(asked).filter(
    (name) => defined.has(name) === false && name.startsWith("--font-") === false,
  );
  expect(missing).toEqual([]);
});

test("the shadows are available as Tailwind classes", async () => {
  const source = await css();
  expect(source).toContain("--shadow-card: var(--card-shadow)");
  expect(source).toContain("--shadow-lift: var(--lift-shadow)");
});

test("the entrance of the cards is switched off for people who asked for less motion", async () => {
  const source = await css();
  const media = source.indexOf("@media (prefers-reduced-motion: reduce)");
  expect(media).toBeGreaterThan(source.indexOf(".rise"));
  const block = source.slice(media);
  expect(block).toContain("animation-duration: 0.01ms");
  expect(block).toContain("animation-iteration-count: 1");
});

test("the soft glow behind the pages uses colors that are defined for both themes", async () => {
  const source = await css();
  const body = blockOf(source, "body {");
  expect(body).toContain("radial-gradient");
  expect(body).toContain("var(--glow)");
  expect(body).toContain("background-color: var(--background)");
});
