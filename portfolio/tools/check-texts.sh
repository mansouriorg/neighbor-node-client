# check-texts.sh: reads the texts in portfolio/texts/ and checks them. It changes nothing
# except the three facts files in portfolio/, which it counts again first.
#
# Use it inside the project folder, as often as you like, for example after you filled in a TODO:
#   bash portfolio/tools/check-texts.sh
#
# What it checks:
#   - a number that is written next to a fact key (for example `lines_code`) is the counted number
#   - every other number in the texts is a counted number, a version from package.json, or is
#     listed in numbers-allowed.txt. Small numbers that are counted somewhere pass this test, so it
#     cannot catch every invented number: read the numbers you add yourself.
#   - every file named in `backticks` exists in the project
#   - every link is one that you wrote in profile.json (or the local address)
#   - none of the empty big words (cutting-edge, seamless, powerful ...) is used
#   - the four lengths in project-description.md are the right size
#   - the other texts keep their shape: 6 resume bullets with one counted number each, the LinkedIn
#     post and the GitHub About text are short enough, there are 8 GitHub topics, the pitch has the
#     right number of words, there are 10 interview questions, and the video script fits its time
#     (a time like 1:10 is not read as a number)
#   - it lists the lines that start a note to you (the capital word TODO and a colon)
# Exit codes: 0 nothing to fix, 3 something to fix (the lines say what), 1 the tool could not run.

TOOLS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$TOOLS/../.." && pwd)"
cd "$ROOT" || { echo "Cannot enter the project folder: $ROOT"; exit 1; }
if grep -q '"name": "neighbor-node"' package.json 2>/dev/null; then
  :
else
  echo "This is not the neighbor-node project folder: $ROOT"
  exit 1
fi
if [ -d portfolio/texts ]; then
  :
else
  echo "There is no folder portfolio/texts/ yet."
  exit 1
fi

echo "Counting the project again, so that the numbers are fresh ..."
bash "$TOOLS/facts.sh" > /dev/null 2>&1
FACTS_RC=$?
if [ "$FACTS_RC" -ne 0 ]; then
  echo "The counting tool failed. Run it to see why:  bash portfolio/tools/facts.sh"
  exit 1
fi

node - "$ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
// The project folder comes as the last argument.
const root = process.argv[process.argv.length - 1];
const portfolio = path.join(root, "portfolio");
const textsDir = path.join(portfolio, "texts");
const problems = [];

function read(p) { return fs.readFileSync(p, "utf8"); }
function isThere(p) { return fs.existsSync(p); }
function ok(text) { console.log("  ok     " + text); }
function fix(text) { problems.push(text); console.log("  FIX    " + text); }

// 1. What was counted: facts.txt has one line, key=value, for each number.
const counted = {};
for (const line of read(path.join(portfolio, "facts.txt")).split("\n")) {
  const at = line.indexOf("=");
  if (at > 0) counted[line.slice(0, at)] = line.slice(at + 1).trim();
}
const keys = Object.keys(counted);
if (keys.length === 0) {
  console.log("portfolio/facts.txt has no numbers in it.");
  process.exit(1);
}
const countedValues = new Set(keys.map((k) => counted[k]));

// 2. The versions in package.json. "Next.js 16" is fine when the version is 16.2.1.
const pkg = JSON.parse(read(path.join(root, "package.json")));
const versions = [];
for (const group of [pkg.dependencies, pkg.devDependencies]) {
  if (group === undefined) continue;
  for (const name of Object.keys(group)) versions.push(String(group[name]).replace(/^[^0-9]*/, ""));
}
function isVersion(token) {
  return versions.some((v) => v === token || v.indexOf(token + ".") === 0);
}

// Writes like 23,300 become 23300. The numbers of a text are the digits with dots between.
function plain(text) {
  let t = text;
  for (let i = 0; i < 3; i++) t = t.replace(/([0-9]),([0-9]{3})([^0-9]|$)/g, "$1$2$3");
  return t;
}
function numbersIn(text) { return plain(text).match(/[0-9]+(?:\.[0-9]+)*/g) || []; }

// 3. Numbers that are allowed because a file of the project holds them.
const allowed = new Set();
const allowedFile = path.join(portfolio, "tools", "numbers-allowed.txt");
if (isThere(allowedFile)) {
  for (const raw of read(allowedFile).split("\n")) {
    const text = raw.trim();
    if (text.length === 0 || text.charAt(0) === "#") continue;
    const parts = text.split(/\s+/);
    const number = parts[0];
    const file = parts[1];
    if (file === undefined || isThere(path.join(root, file)) === false) {
      fix("numbers-allowed.txt: the file for " + number + " was not found");
    } else if (numbersIn(read(path.join(root, file))).indexOf(number) < 0) {
      fix("numbers-allowed.txt: " + number + " is not written in " + file);
    } else {
      allowed.add(number);
    }
  }
}

// 4. The links the author gave in profile.json.
const myLinks = [];
const profileFile = path.join(portfolio, "profile.json");
if (isThere(profileFile)) {
  try {
    const profile = JSON.parse(read(profileFile));
    const links = profile.links || {};
    for (const k of Object.keys(links)) {
      if (typeof links[k] === "string" && links[k].trim().length > 0) myLinks.push(links[k].trim());
    }
  } catch (error) {
    fix("portfolio/profile.json is not valid JSON");
  }
}

// 5. All file names of the project, for names written without a folder (page.tsx, README.md).
const names = new Set();
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const skip = entry.name.charAt(0) === "." || entry.name === "node_modules" || entry.name === "coverage" || entry.name === "data";
      if (skip === false) walk(path.join(dir, entry.name));
    } else {
      names.add(entry.name);
    }
  }
}
walk(root);
// Files that are made when the site runs, so they may not be there yet.
const madeLater = ["data/", "data/posts.json", "posts.json", "robots.txt", "sitemap.xml"];

function looksLikeFile(token) {
  if (/^[A-Za-z0-9_.\[\]\/-]+$/.test(token) === false) return false;
  if (token.charAt(0) === "/") return false;
  if (token.charAt(token.length - 1) === "/") return true;
  return /\.(ts|tsx|mts|mjs|css|json|md|txt|sh|xml|ico)$/.test(token);
}
function fileExists(token) {
  if (madeLater.indexOf(token) >= 0) return true;
  if (isThere(path.join(root, token))) return true;
  return token.indexOf("/") < 0 && names.has(token);
}

const buzz = /(cutting-edge|revolutionary|seamless|robust|powerful|game-chang|state-of-the-art|world-class|best-in-class|groundbreaking|next-generation|blazing|lightning-fast|passionate)/i;

// 6. The texts.
const files = fs.readdirSync(textsDir).filter((f) => /\.md$/.test(f)).sort();
if (files.length === 0) {
  console.log("There are no .md files in portfolio/texts/.");
  process.exit(1);
}
const todos = [];
let fileChecks = 0;
let numberChecks = 0;
let keyChecks = 0;
let nameChecks = 0;
let linkChecks = 0;

for (const file of files) {
  const lines = read(path.join(textsDir, file)).split("\n");
  lines.forEach((line, index) => {
    const where = file + ":" + (index + 1);
    if (line.indexOf("TODO:") >= 0) todos.push(where + "  " + line.replace(/^[\s>-]*/, "").slice(0, 100));

    // numbers
    const body = line.replace(/^[\s>]*/, "").replace(/^[0-9]+[.)]\s+/, "").replace(/[0-9]+:[0-9]{2}/g, " ");
    for (const token of numbersIn(body)) {
      numberChecks++;
      if (countedValues.has(token) || isVersion(token) || allowed.has(token)) continue;
      fix(where + ": the number " + token + " is not a counted number (see facts.txt)");
    }

    // pieces in backticks
    const pieces = line.split("`");
    for (let i = 1; i < pieces.length; i += 2) {
      const token = pieces[i];
      if (typeof counted[token] === "string") {
        keyChecks++;
        if (numbersIn(body).indexOf(counted[token]) < 0) {
          fix(where + ": " + token + " is " + counted[token] + " in facts.txt, but this line does not say so");
        }
      }
      if (looksLikeFile(token)) {
        nameChecks++;
        if (fileExists(token) === false) fix(where + ": the file " + token + " does not exist in the project");
      }
    }

    // links
    for (const found of line.match(/https?:\/\/[^\s)>\]`"']+/g) || []) {
      linkChecks++;
      const link = found.replace(/[.,;:]+$/, "");
      if (link === "http://localhost:3000" || myLinks.indexOf(link) >= 0) continue;
      fix(where + ": the link " + link + " is not in portfolio/profile.json");
    }

    // empty big words
    const word = line.match(buzz);
    if (word) fix(where + ": the word " + word[0] + " says nothing; use a plain fact instead");
  });
  fileChecks++;
}

console.log("  ok     " + fileChecks + " text file(s) read: " + files.join(", "));
console.log("  ok     " + numberChecks + " numbers, " + keyChecks + " numbers next to a fact key, " + nameChecks + " file names and " + linkChecks + " links looked at");

// 7. The shape of each text that has rules. A text is only checked when it is there.
function sectionsOf(file) {
  const out = {};
  let current = null;
  for (const line of read(path.join(textsDir, file)).split("\n")) {
    if (line.indexOf("## ") === 0) { current = line.slice(3).trim(); out[current] = []; continue; }
    if (current === null) continue;
    out[current].push(line);
  }
  return out;
}
function nonEmpty(lines) { return lines.filter((l) => l.trim().length > 0); }
function rawText(lines) { return lines.join("\n").trim(); }
function has(file) { return isThere(path.join(textsDir, file)); }
function wordsOf(text) { return text.split(/\s+/).filter((w) => w.length > 0).length; }
function bulletsOf(lines) { return nonEmpty(lines).filter((l) => l.indexOf("- ") === 0).map((l) => l.slice(2).trim()); }

if (has("project-description.md")) {
  const parts = sectionsOf("project-description.md");
  const one = nonEmpty(parts["One line"] || []);
  if (one.length === 1) {
    if (one[0].length > 140) {
      fix("project-description.md: One line has " + one[0].length + " characters; the most is 140");
    } else {
      ok("project-description.md, One line: " + one[0].length + " characters (the most is 140)");
    }
  } else {
    fix("project-description.md: the part One line must be exactly one line");
  }
  for (const rule of [["Short", 40, 65], ["Medium", 120, 180], ["Long", 330, 470]]) {
    const part = nonEmpty(parts[rule[0]] || []);
    if (part.length === 0) { fix("project-description.md: the part " + rule[0] + " is missing"); continue; }
    const words = wordsOf(part.join(" "));
    if (words < rule[1] || words > rule[2]) {
      fix("project-description.md, " + rule[0] + ": " + words + " words; aim for " + rule[1] + " to " + rule[2]);
    } else {
      ok("project-description.md, " + rule[0] + ": " + words + " words (aim for " + rule[1] + " to " + rule[2] + ")");
    }
  }
}

if (has("resume-bullets.md")) {
  const bullets = bulletsOf(sectionsOf("resume-bullets.md")["Bullets"] || []);
  if (bullets.length === 6) {
    let good = 0;
    bullets.forEach((b, i) => {
      const found = numbersIn(b.replace(/[0-9]+:[0-9]{2}/g, " "));
      if (found.length === 1 && countedValues.has(found[0])) {
        good++;
      } else {
        fix("resume-bullets.md: bullet " + (i + 1) + " must have exactly one number, and it must be a counted number (it has " + found.length + ")");
      }
    });
    if (good === 6) ok("resume-bullets.md: 6 bullets, each with one counted number");
  } else {
    fix("resume-bullets.md: there must be 6 bullets under Bullets (there are " + bullets.length + ")");
  }
}

if (has("linkedin-post.md")) {
  const post = rawText(sectionsOf("linkedin-post.md")["Post"] || []);
  if (post.length === 0) {
    fix("linkedin-post.md: the part Post is missing");
  } else if (post.length > 1300) {
    fix("linkedin-post.md: the post has " + post.length + " characters; the most is 1300");
  } else {
    ok("linkedin-post.md: the post has " + post.length + " characters (the most is 1300)");
  }
}

if (has("github-about.md")) {
  const s = sectionsOf("github-about.md");
  const about = rawText(s["About"] || []);
  if (about.length === 0) {
    fix("github-about.md: the part About is missing");
  } else if (about.length > 350) {
    fix("github-about.md: About has " + about.length + " characters; the most is 350");
  } else {
    ok("github-about.md: About has " + about.length + " characters (the most is 350)");
  }
  const topics = bulletsOf(s["Topics"] || []);
  const shaped = topics.every((x) => /^[a-z0-9][a-z0-9-]{0,49}$/.test(x));
  if (topics.length === 8 && shaped) {
    ok("github-about.md: 8 topics, each in the form GitHub accepts");
  } else {
    fix("github-about.md: Topics must be 8 lines that start with '- ', each with lowercase letters, digits and hyphens, at most 50 long (there are " + topics.length + ")");
  }
}

if (has("cover-letter-pitch.md")) {
  const words = wordsOf(rawText(sectionsOf("cover-letter-pitch.md")["Pitch"] || []));
  if (words < 60 || words > 100) {
    fix("cover-letter-pitch.md: the pitch has " + words + " words; aim for 60 to 100");
  } else {
    ok("cover-letter-pitch.md: the pitch has " + words + " words (aim for 60 to 100)");
  }
}

if (has("interview-answers.md")) {
  const s = sectionsOf("interview-answers.md");
  const questions = Object.keys(s).filter((h) => h.charAt(h.length - 1) === "?");
  if (questions.length === 10) {
    ok("interview-answers.md: 10 questions");
  } else {
    fix("interview-answers.md: there must be 10 questions (headings that end with a question mark); there are " + questions.length);
  }
  const noAnswer = questions.filter((h) => s[h].join("\n").indexOf("In my words:") < 0);
  if (noAnswer.length > 0) fix("interview-answers.md: these questions have no 'In my words:' answer: " + noAnswer.join(" | "));
  if ((s["Before you use these"] || []).join(" ").indexOf("AI assistant") < 0) {
    fix("interview-answers.md: the part Before you use these must say that an AI assistant helped");
  }
}

if (has("demo-video-script.md")) {
  const rows = [];
  for (const line of read(path.join(textsDir, "demo-video-script.md")).split("\n")) {
    const m = line.match(/^\|\s*([0-9]+):([0-9]{2})-([0-9]+):([0-9]{2})\s*\|([^|]*)\|([^|]*)\|\s*$/);
    if (m) rows.push({ start: Number(m[1]) * 60 + Number(m[2]), end: Number(m[3]) * 60 + Number(m[4]), say: m[6] });
  }
  const total = rows.length > 0 ? rows[rows.length - 1].end : 0;
  const words = rows.reduce((sum, r) => sum + wordsOf(r.say), 0);
  const rate = total > 0 ? words / total : 0;
  let problem = "";
  if (rows.length < 5) {
    problem = "the table must have at least 5 scenes (there are " + rows.length + ")";
  } else if (rows[0].start > 0) {
    problem = "the first scene must start at 0:00";
  } else {
    for (let i = 0; i < rows.length && problem === ""; i++) {
      if (rows[i].end <= rows[i].start) problem = "scene " + (i + 1) + " ends before it starts";
      else if (i > 0 && (rows[i].start === rows[i - 1].end) === false) problem = "scene " + (i + 1) + " does not start where scene " + i + " ends";
    }
  }
  if (problem === "" && (total < 60 || total > 90)) problem = "the video must be 60 to 90 seconds long (it is " + total + ")";
  if (problem === "" && (rate < 1.6 || rate > 2.8)) problem = "the words do not fit the time: " + rate.toFixed(1) + " words a second (aim for 1.6 to 2.8)";
  if (problem === "") {
    ok("demo-video-script.md: " + rows.length + " scenes, " + total + " seconds, " + words + " words (" + rate.toFixed(1) + " words a second)");
  } else {
    fix("demo-video-script.md: " + problem);
  }
}

// 8. What is left for the author.
console.log("");
console.log("Left for you (notes that start with the word TODO): " + todos.length + " line(s)");
for (const t of todos) console.log("  " + t);

console.log("");
if (problems.length === 0) {
  console.log("Nothing to fix.");
} else {
  console.log(problems.length + " thing(s) to fix. Each FIX line above says the file, the line and what is wrong.");
  process.exitCode = 3;
}
NODE
NODE_RC=$?
exit "$NODE_RC"
