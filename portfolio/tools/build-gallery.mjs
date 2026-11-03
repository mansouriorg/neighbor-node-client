// build-gallery.mjs: writes the files that describe the pictures, from portfolio/screenshots/index.json.
//   portfolio/manifest.json            every picture with its caption, alt text, size and fingerprint
//   portfolio/screenshot-captions.md   the same, as text you can copy from, with a line of Markdown for each picture
//   portfolio/gallery.html             a page that shows all the pictures (no script, nothing from the internet)
//   portfolio/problems/picture-problems.md   what could not be done
// Run it by hand after you changed a caption in index.json:  node portfolio/tools/build-gallery.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const portfolio = path.join(root, "portfolio");
const shotsDir = path.join(portfolio, "screenshots");
const today = new Date().toISOString().slice(0, 10);
// The exclamation mark of the first line of a web page is written like this, so that this file can be pasted into a terminal.
const BANG = String.fromCharCode(33);

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
}
function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const index = readJson(path.join(shotsDir, "index.json"), { pictures: {}, problems: {} });

// The order: the site pictures by device and theme as they were taken, then the diagram, then the tests.
const groupOrder = { site: 0, diagram: 1, tests: 2 };
const deviceOrder = { desktop: 0, phone: 1 };
const themeOrder = { light: 0, dark: 1 };
function placeOf(p) {
  return (groupOrder[p.group] || 0) * 100 + (deviceOrder[p.device] || 0) * 10 + (themeOrder[p.theme] || 0);
}
const pictures = Object.values(index.pictures)
  .filter((p) => fs.existsSync(path.join(shotsDir, p.file)))
  .sort((a, b) => placeOf(a) - placeOf(b));

// 1. The problems file.
const lines = [];
lines.push("# Problems with the pictures");
lines.push("");
lines.push("This file is written again every time the pictures are made. Your own notes belong in `problems.md`, which the tools never overwrite.");
lines.push("");
let problemCount = 0;
const workProblems = path.join(portfolio, ".work", "problems.txt");
const fromScript = fs.existsSync(workProblems) ? fs.readFileSync(workProblems, "utf8").split("\n").filter((l) => l.trim().length > 0) : [];
const all = [];
for (const key of Object.keys(index.problems || {})) {
  for (const text of index.problems[key]) all.push(text);
}
for (const text of fromScript) all.push(text);
for (const text of all) {
  lines.push("- " + text);
  problemCount++;
}
if (problemCount === 0) lines.push("Nothing to report.");
lines.push("");
fs.mkdirSync(path.join(portfolio, "problems"), { recursive: true });
fs.writeFileSync(path.join(portfolio, "problems", "picture-problems.md"), lines.join("\n"));

// 2. manifest.json
const textsDir = path.join(portfolio, "texts");
const texts = fs.existsSync(textsDir)
  ? fs.readdirSync(textsDir).filter((f) => /\.md$/.test(f)).sort().map((f) => ({ file: "texts/" + f, bytes: fs.statSync(path.join(textsDir, f)).size }))
  : [];
const manifest = {
  generated: today,
  note: "Written by portfolio/tools/build-gallery.mjs. The sizes are read from the picture files. The sha256 value lets you check that a picture was not changed after it was made.",
  site: "The pictures were made from the site on localhost, with the sample posts and the posts saved on this computer. No sign-in was used, because the site has none.",
  pictures: pictures.map((p) => ({
    file: "screenshots/" + p.file,
    title: p.title,
    caption: p.caption,
    alt: p.alt,
    group: p.group,
    page: p.page || null,
    route: p.route || null,
    theme: p.theme || null,
    device: p.device || null,
    full_page: p.full_page === undefined ? null : p.full_page,
    width_px: p.width_px,
    height_px: p.height_px,
    scale: p.scale,
    bytes: p.bytes,
    sha256: sha256(path.join(shotsDir, p.file)),
    taken: p.taken,
    exit_code: p.exit_code === undefined ? null : p.exit_code,
    passed: p.passed === undefined ? null : p.passed,
  })),
  tests: pictures.filter((p) => p.group === "tests").map((p) => ({ exit_code: p.exit_code, passed: p.passed, summary: p.summary })),
  texts,
  problems_file: "problems/picture-problems.md",
};
fs.writeFileSync(path.join(portfolio, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// 3. screenshot-captions.md
const md = [];
md.push("# Captions and alt texts for the pictures");
md.push("");
md.push("Made on " + today + " by `portfolio/tools/build-gallery.mjs`. Each picture has a caption (a line under the picture) and an alt text (read aloud by a screen reader, and shown when the picture does not load). Copy the Markdown line to put a picture in a README.");
md.push("");
if (pictures.length === 0) md.push("There are no pictures yet. Run `bash portfolio/tools/make-pictures.sh`.");
for (const p of pictures) {
  md.push("## " + p.title);
  md.push("");
  md.push("- File: `screenshots/" + p.file + "`");
  md.push("- Size: " + p.width_px + " by " + p.height_px + " pixels, " + Math.round(p.bytes / 1024) + " KB");
  md.push("- Caption: " + p.caption);
  md.push("- Alt text: " + p.alt);
  md.push("");
  md.push("    " + BANG + "[" + p.caption + "](portfolio/screenshots/" + p.file + ")");
  md.push("");
}
fs.writeFileSync(path.join(portfolio, "screenshot-captions.md"), md.join("\n"));

// 4. gallery.html
function figure(p) {
  const w = Math.round(p.width_px / p.scale);
  const h = Math.round(p.height_px / p.scale);
  return "<figure><a href=\"screenshots/" + escapeHtml(p.file) + "\"><img src=\"screenshots/" + escapeHtml(p.file) + "\" alt=\"" + escapeHtml(p.alt) + "\" width=\"" + w + "\" height=\"" + h + "\" loading=\"lazy\"></a><figcaption>" + escapeHtml(p.caption) + "</figcaption></figure>";
}
const sections = [
  ["Desktop, light theme", (p) => p.group === "site" && p.device === "desktop" && p.theme === "light"],
  ["Desktop, dark theme", (p) => p.group === "site" && p.device === "desktop" && p.theme === "dark"],
  ["Phone", (p) => p.group === "site" && p.device === "phone"],
  ["Diagram and tests", (p) => (p.group === "site" ? false : true)],
];
const body = [];
for (const section of sections) {
  const chosen = pictures.filter(section[1]);
  if (chosen.length === 0) continue;
  body.push("<section><h2>" + escapeHtml(section[0]) + "</h2><div class=\"grid\">" + chosen.map(figure).join("") + "</div></section>");
}
if (body.length === 0) body.push("<p>There are no pictures yet. Run <code>bash portfolio/tools/make-pictures.sh</code>.</p>");
const page = "<" + BANG + "doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Neighbor Node: pictures</title>\n<style>\n"
  + ":root{color-scheme:light dark}\n"
  + "body{margin:0;font:16px/1.5 system-ui,sans-serif;background:#fff;color:#161616}\n"
  + "@media (prefers-color-scheme: dark){body{background:#121212;color:#ececec}a{color:#8ab4ff}}\n"
  + "main{max-width:1200px;margin:0 auto;padding:24px}\n"
  + "h1{margin:0 0 8px}h2{margin:40px 0 12px}\n"
  + ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px}\n"
  + "figure{margin:0;border:1px solid #8886;border-radius:8px;padding:12px}\n"
  + "img{display:block;width:100%;height:auto;max-height:520px;object-fit:cover;object-position:top;border-radius:4px}\n"
  + "figcaption{margin-top:8px;font-size:14px}\n"
  + "</style>\n</head>\n<body>\n<main>\n<h1>Neighbor Node: pictures</h1>\n<p>Made on " + today + " from the site on localhost. Click a picture to see it in full size. The captions and alt texts are in <a href=\"screenshot-captions.md\">screenshot-captions.md</a>.</p>\n"
  + body.join("\n") + "\n</main>\n</body>\n</html>\n";
fs.writeFileSync(path.join(portfolio, "gallery.html"), page);

console.log("  wrote portfolio/manifest.json (" + pictures.length + " pictures)");
console.log("  wrote portfolio/screenshot-captions.md");
console.log("  wrote portfolio/gallery.html");
console.log("  wrote portfolio/problems/picture-problems.md (" + problemCount + " note(s))");
