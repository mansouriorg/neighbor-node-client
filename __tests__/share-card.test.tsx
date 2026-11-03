import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  ShareCard,
  shareCardColors,
  shareCardText,
} from "@/components/share-card";
import { postKindIds, postKindInfo } from "@/lib/post-kinds";

// The share card is drawn by Satori, which understands only a small part of
// HTML and CSS. These tests walk through the card and check the rules it needs.

type Element = { type: string; props: Record<string, unknown> };

function isElement(value: unknown): value is Element {
  return value instanceof Object && "type" in value && "props" in value;
}

// The children of an element, with lists from .map() flattened and empty ones dropped.
function childrenOf(element: Element): unknown[] {
  const empty: unknown[] = [undefined, null, false];
  const list = ([element.props.children] as unknown[]).flat(Infinity);
  return list.filter((child) => empty.includes(child) === false);
}

function allElements(node: unknown): Element[] {
  if (isElement(node)) {
    return [node, ...childrenOf(node).flatMap(allElements)];
  }
  return [];
}

function allText(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (isElement(node)) return childrenOf(node).flatMap(allText);
  return [];
}

function styleOf(element: Element): Record<string, unknown> {
  const style = element.props.style;
  return style instanceof Object ? (style as Record<string, unknown>) : {};
}

const elements = allElements(ShareCard());
const boxes = elements.filter((element) => element.type === "div");

// The CSS properties Satori documents. Anything else may be ignored or fail.
const satoriStyles = [
  "display", "position", "top", "right", "bottom", "left",
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
  "padding", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "border", "borderRadius", "flexDirection", "flexWrap", "flexGrow",
  "flexShrink", "flexBasis", "alignItems", "alignContent", "alignSelf",
  "justifyContent", "gap", "fontFamily", "fontSize", "fontWeight",
  "fontStyle", "textAlign", "lineHeight", "letterSpacing", "color",
  "backgroundColor", "opacity", "overflow", "boxShadow",
];

test("draws something: boxes, one house mark and some text", () => {
  expect(boxes.length).toBeGreaterThan(5);
  expect(elements.filter((element) => element.type === "svg").length).toBe(1);
});

test("uses no class names, because Satori does not read them", () => {
  for (const element of elements) {
    expect(element.props.className).toBeUndefined();
    expect(element.props.tw).toBeUndefined();
  }
});

test("every box says display: flex, as Satori wants", () => {
  for (const box of boxes) {
    expect(styleOf(box).display).toBe("flex");
  }
});

test("uses only styles that Satori documents, in plain units", () => {
  for (const element of elements) {
    for (const [name, value] of Object.entries(styleOf(element))) {
      expect(satoriStyles).toContain(name);
      if (typeof value === "string") {
        expect(/var\(|calc\(|\d(rem|em|vh|vw)\b/.test(value)).toBe(false);
      }
    }
  }
});

test("a box holds one piece of text, or other boxes, never both", () => {
  for (const box of boxes) {
    const children = childrenOf(box);
    const texts = children.filter((child) => typeof child === "string");
    expect(texts.length).toBeLessThan(2);
    if (texts.length === 1) expect(children.length).toBe(1);
  }
});

test("the house mark has the size and shape that Satori needs", () => {
  const svg = elements.filter((element) => element.type === "svg")[0];
  expect(svg.props.width).toBeDefined();
  expect(svg.props.height).toBeDefined();
  expect(svg.props.viewBox).toBe("0 0 24 24");
  expect(svg.props.fill).toBe(shareCardColors.accent);
  const paths = elements.filter((element) => element.type === "path");
  expect(paths.length).toBe(1);
  expect(typeof paths[0].props.d).toBe("string");
});

test("shows the name, the headline, the tagline and the three kinds", () => {
  const text = allText(ShareCard());
  expect(shareCardText.name).toBe("Neighbor Node");
  expect(text).toContain(shareCardText.name);
  for (const line of shareCardText.headline) expect(text).toContain(line);
  expect(text).toContain(shareCardText.tagline);
  for (const id of postKindIds) expect(text).toContain(postKindInfo[id].label);
});

test("uses only the colors of the design, and nothing else", () => {
  const allowed = Object.values(shareCardColors) as string[];
  for (const element of elements) {
    const values = [...Object.values(styleOf(element)), element.props.fill];
    for (const value of values) {
      if (typeof value === "string" && value.startsWith("#")) {
        expect(allowed).toContain(value);
      }
    }
  }
});

// The first :root block of app/globals.css holds the light colors.
function lightTokens(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
  const block = /:root\s*\{([^}]*)\}/.exec(css);
  const tokens: Record<string, string> = {};
  for (const match of (block === null ? "" : block[1]).matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g,
  )) {
    tokens[match[1]] = match[2].toLowerCase();
  }
  return tokens;
}

test("the colors still match the light colors in app/globals.css", () => {
  const tokens = lightTokens();
  expect(shareCardColors.background).toBe(tokens["background"]);
  expect(shareCardColors.foreground).toBe(tokens["foreground"]);
  expect(shareCardColors.muted).toBe(tokens["muted"]);
  expect(shareCardColors.accent).toBe(tokens["accent"]);
  expect(shareCardColors.accentSoft).toBe(tokens["accent-soft"]);
  expect(shareCardColors.help).toBe(tokens["help"]);
  expect(shareCardColors.helpSoft).toBe(tokens["help-soft"]);
  expect(shareCardColors.offer).toBe(tokens["offer"]);
  expect(shareCardColors.offerSoft).toBe(tokens["offer-soft"]);
  expect(shareCardColors.lend).toBe(tokens["lend"]);
  expect(shareCardColors.lendSoft).toBe(tokens["lend-soft"]);
});

// WCAG contrast ratio between two colors like #1c2620.
function channel(hex: string, start: number): number {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}
function contrast(a: string, b: string): number {
  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return (light + 0.05) / (dark + 0.05);
}

test("text is easy to read: contrast of at least 4.5 to 1", () => {
  const c = shareCardColors;
  const pairs: [string, string][] = [
    [c.foreground, c.background],
    [c.muted, c.background],
    [c.help, c.helpSoft],
    [c.offer, c.offerSoft],
    [c.lend, c.lendSoft],
  ];
  for (const [text, back] of pairs) {
    expect(contrast(text, back)).toBeGreaterThan(4.5);
  }
});

test("the house mark stands out from the background: at least 3 to 1", () => {
  expect(
    contrast(shareCardColors.accent, shareCardColors.background),
  ).toBeGreaterThan(3);
});
