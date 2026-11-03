# check-portfolio.sh: the last check of the whole portfolio folder. Use it inside the project folder:
#   bash portfolio/tools/check-portfolio.sh
# It looks at: the files that must be there, every picture (it is a real PNG, has the size and the
# fingerprint that manifest.json says, has a caption and an alt text), the numbers in the captions and
# in the diagram (they must be counted numbers), the gallery page (it points only to files that exist
# and loads nothing from the internet), and the texts (it runs check-texts.sh). It also looks for keys,
# tokens and e-mail addresses in the text files. It changes nothing, except that check-texts.sh counts
# the project again first, as it always does.
# Exit codes: 0 everything is fine, 3 something is wrong (the FAIL lines say what), 1 it could not run.

TOOLS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$TOOLS/../.." && pwd)"
cd "$ROOT" || { echo "Cannot enter the project folder: $ROOT"; exit 1; }
if grep -q '"name": "neighbor-node"' package.json 2>/dev/null; then
  :
else
  echo "This is not the neighbor-node project folder: $ROOT"
  exit 1
fi

node - "$ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");
const root = process.argv[process.argv.length - 1];
const portfolio = path.join(root, "portfolio");
let passed = 0;
const failed = [];
function pass(text) { passed++; console.log("  PASS  " + text); }
function fail(text) { failed.push(text); console.log("  FAIL  " + text); }
function check(condition, goodText, badText) { if (condition) pass(goodText); else fail(badText || goodText); }
function readText(p) { return fs.readFileSync(p, "utf8"); }
function readJson(p) { try { return JSON.parse(readText(p)); } catch (error) { return null; } }

// 1. The files that must be there.
const must = [
  "README.md", "facts.md", "facts.json", "facts.txt", "profile.json", "problems/problems.md", "problems/picture-problems.md",
  "manifest.json", "gallery.html", "screenshot-captions.md", "screenshots/index.json", "screenshots/architecture.svg",
  "texts/project-description.md", "texts/case-study.md", "texts/readme-portfolio.md", "texts/resume-bullets.md",
  "texts/linkedin-post.md", "texts/github-about.md", "texts/cover-letter-pitch.md", "texts/interview-answers.md", "texts/demo-video-script.md",
  "tools/facts.sh", "tools/check-texts.sh", "tools/browser.mjs", "tools/shots.mjs", "tools/make-pictures.sh", "tools/build-gallery.mjs", "tools/check-portfolio.sh",
];
const missing = must.filter((f) => fs.existsSync(path.join(portfolio, f)) === false);
check(missing.length === 0, "all " + must.length + " files of the portfolio folder are there", "these files are missing: " + missing.join(", "));

// 2. What was counted, and which other numbers may be written.
const counted = new Set();
for (const line of fs.existsSync(path.join(portfolio, "facts.txt")) ? readText(path.join(portfolio, "facts.txt")).split("\n") : []) {
  const at = line.indexOf("=");
  if (at > 0) counted.add(line.slice(at + 1).trim());
}
const allowedFile = path.join(portfolio, "tools", "numbers-allowed.txt");
if (fs.existsSync(allowedFile)) {
  for (const line of readText(allowedFile).split("\n")) {
    const first = line.trim().split(/\s+/)[0];
    if (first && (first.charAt(0) === "#") === false) counted.add(first);
  }
}
function numbersIn(text) { return text.replace(/([0-9]),([0-9]{3})/g, "$1$2").match(/[0-9]+(?:\.[0-9]+)*/g) || []; }
function strangeNumbers(text) { return numbersIn(text).filter((n) => counted.has(n) === false); }
const buzz = /(cutting-edge|revolutionary|seamless|robust|powerful|game-chang|state-of-the-art|world-class|best-in-class|groundbreaking|next-generation|blazing|lightning-fast|passionate)/i;

// 3. The pictures.
const manifest = readJson(path.join(portfolio, "manifest.json"));
const pictures = manifest && Array.isArray(manifest.pictures) ? manifest.pictures : [];
check(pictures.length > 0, pictures.length + " pictures are listed in manifest.json", "manifest.json lists no pictures (see problems/picture-problems.md for the reason)");
let badFile = [];
let badWords = [];
let badNumbers = [];
let badAlt = [];
for (const p of pictures) {
  const file = path.join(portfolio, p.file);
  if (fs.existsSync(file) === false) { badFile.push(p.file + " is missing"); continue; }
  const bytes = fs.readFileSync(file);
  const png = bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (png === false) { badFile.push(p.file + " is not a PNG"); continue; }
  if ((bytes.readUInt32BE(16) === p.width_px && bytes.readUInt32BE(20) === p.height_px) === false) badFile.push(p.file + " has another size than the manifest says");
  if ((crypto.createHash("sha256").update(bytes).digest("hex") === p.sha256) === false) badFile.push(p.file + " was changed after the manifest was written");
  if (typeof p.caption === "string" && p.caption.length >= 10 && typeof p.alt === "string" && p.alt.length >= 20 && p.alt.length <= 600) { /* fine */ } else badAlt.push(p.file);
  for (const text of [p.title, p.caption, p.alt]) {
    if (buzz.test(text || "")) badWords.push(p.file);
    if (strangeNumbers(text || "").length > 0) badNumbers.push(p.file + " (" + strangeNumbers(text || "").join(", ") + ")");
  }
}
check(badFile.length === 0, "every picture is a real PNG with the size and the fingerprint of the manifest", badFile.join("; "));
check(badAlt.length === 0, "every picture has a caption and an alt text of a sensible length", "no caption or alt text, or a wrong length: " + badAlt.join(", "));
check(badWords.length === 0, "no empty big word in a caption or an alt text", "an empty big word in: " + badWords.join(", "));
check(badNumbers.length === 0, "every number in a caption or an alt text is a counted number", "numbers that nobody counted: " + badNumbers.join("; "));

// 4. The plan: how many pages in each kind of picture.
function many(device, theme) { return pictures.filter((p) => p.group === "site" && p.device === device && p.theme === theme).length; }
const light = many("desktop", "light");
const dark = many("desktop", "dark");
const phone = many("phone", "light");
check(light >= 8, light + " pages in the light theme on a desktop screen (at least 8 are planned)", "only " + light + " pages in the light theme on a desktop screen (at least 8 are planned)");
check(dark >= 8 && dark <= 10, dark + " pages in the dark theme (8 to 10 are planned)", dark + " pages in the dark theme (8 to 10 are planned)");
check(phone >= 6 && phone <= 8, phone + " pages on a phone screen (6 to 8 are planned)", phone + " pages on a phone screen (6 to 8 are planned)");
check(pictures.some((p) => p.group === "site" && p.page === "not-found"), "the page for an address that does not exist is shown", "no picture of the not-found page");
check(pictures.some((p) => p.group === "diagram"), "the architecture diagram is there", "no architecture diagram picture");
const testPicture = pictures.find((p) => p.group === "tests");
check(testPicture === undefined ? false : true, "the picture of the test output is there", "no picture of the test output");
check(testPicture === undefined || testPicture.passed === true, "the tests passed in the run of the picture", "npm test did not pass in the run of the picture (exit code " + (testPicture ? testPicture.exit_code : "unknown") + ")");

// 5. The numbers in the diagram.
const svgFile = path.join(portfolio, "screenshots", "architecture.svg");
if (fs.existsSync(svgFile)) {
  const words = (readText(svgFile).match(/<text[^>]*>([^<]*)<\/text>/g) || []).map((t) => t.replace(/<[^>]*>/g, " ")).join(" ");
  check(strangeNumbers(words).length === 0, "every number in the diagram is a counted number", "numbers in the diagram that nobody counted: " + strangeNumbers(words).join(", "));
}

// 6. The gallery page.
const galleryFile = path.join(portfolio, "gallery.html");
if (fs.existsSync(galleryFile)) {
  const html = readText(galleryFile);
  const sources = (html.match(/src="([^"]+)"/g) || []).map((s) => s.slice(5, -1));
  const gone = sources.filter((s) => fs.existsSync(path.join(portfolio, s)) === false);
  check(gone.length === 0, "the gallery shows " + sources.length + " pictures and all of them exist", "the gallery points to files that do not exist: " + gone.join(", "));
  check(sources.length === pictures.length, "the gallery shows every picture of the manifest", "the gallery shows " + sources.length + " pictures, the manifest lists " + pictures.length);
  check(/https?:\/\//.test(html) === false, "the gallery loads nothing from the internet", "the gallery has an address that starts with http");
}

// 7. The pictures that the front README points to.
const frontFile = path.join(portfolio, "texts", "readme-portfolio.md");
if (fs.existsSync(frontFile)) {
  const pointed = (readText(frontFile).match(/\]\(portfolio\/screenshots\/[^)]+\)/g) || []).map((s) => s.slice(2, -1));
  const gone = pointed.filter((s) => fs.existsSync(path.join(root, s)) === false);
  check(gone.length === 0, "the front README points to " + pointed.length + " pictures and all of them exist", "the front README points to missing pictures: " + gone.join(", "));
}

// 8. Keys, tokens and e-mail addresses in the text files.
const found = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".work") continue;
      walk(full);
    } else {
      if (/\.(md|json|txt|sh|mjs|html|svg)$/.test(entry.name)) scan(full, entry.name);
    }
  }
}
function scan(file, name) {
  const text = readText(file);
  const rules = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
    [/AKIA[0-9A-Z]{16}/, "a cloud access key"],
    [/ghp_[A-Za-z0-9]{20,}/, "a GitHub token"],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, "a chat token"],
    [/sk-[A-Za-z0-9]{20,}/, "a secret key"],
    [/(password|secret|token|api[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i, "a password or token with a value"],
  ];
  for (const rule of rules) if (rule[0].test(text)) found.push(path.relative(root, file) + " has " + rule[1]);
  if ((name === "manifest.json") === false && /\b[0-9a-f]{40,}\b/.test(text)) found.push(path.relative(root, file) + " has a long hex string");
  if ((name === "profile.json") === false && /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/.test(text)) found.push(path.relative(root, file) + " has an e-mail address");
}
walk(portfolio);
check(found.length === 0, "no key, token, password or e-mail address in the text files of portfolio/", found.join("; "));

// 9. The texts.
const texts = spawnSync("bash", [path.join(portfolio, "tools", "check-texts.sh")], { cwd: root, encoding: "utf8" });
const todoLine = (texts.stdout || "").split("\n").filter((l) => l.indexOf("Left for you") === 0)[0] || "";
check(texts.status === 0, "check-texts.sh: nothing to fix. " + todoLine, "check-texts.sh found things to fix (run: bash portfolio/tools/check-texts.sh)");

console.log("");
console.log("SELF-CHECK passed " + passed + ", failed " + failed.length);
if (failed.length > 0) process.exitCode = 3;
NODE
NODE_RC=$?
exit "$NODE_RC"
