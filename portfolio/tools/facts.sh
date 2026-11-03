# facts.sh: counts facts about this project, for the portfolio.
#
# It only READS the project. It writes three files inside portfolio/, and nothing else:
#   portfolio/facts.txt    one line for each number:  key=value
#   portfolio/facts.json   everything, for tools and for the texts
#   portfolio/facts.md     the same, for people, with the command next to each number
#
# Use it inside the project folder:
#   bash portfolio/tools/facts.sh           count, and write the three files
#   bash portfolio/tools/facts.sh check     also compare the numbers with facts-expected.txt
#
# Every number comes from the command that is written next to it. If a command does not
# answer with a number, the tool says so and stops. Exit codes: 0 all fine, 1 a count
# failed, 3 (check only) some numbers are not the ones the texts use.

MODE="${1:-count}"
TOOLS="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$TOOLS/../.." && pwd)"
cd "$ROOT" || { echo "Cannot enter the project folder: $ROOT"; exit 1; }
if grep -q '"name": "neighbor-node"' package.json 2>/dev/null; then
  :
else
  echo "This is not the neighbor-node project folder: $ROOT"
  exit 1
fi

WORK="$ROOT/portfolio/facts.work"
: > "$WORK" || { echo "Cannot write inside portfolio/"; exit 1; }
trap 'rm -f "$WORK"' EXIT
BAD=0

# The files that belong to the project. Left out of every count: installed packages
# (node_modules), every hidden folder (.next, .update-backup and so on), the saved posts
# (data), this portfolio folder, and the *.d.ts files that tools generate.
SKIP="\( -type d \( -name '.?*' -o -name node_modules -o -name data -o -name portfolio -o -name coverage \) -prune \)"
FIND="find . $SKIP -o -type f"
NOD="-not -name '*.d.ts' -not -name '*.d.mts'"
INDIR="-type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.mjs' \) $NOD"

# fact KEY "what it counts" "command": the command runs inside the project folder.
# Its last line of output must be a whole number.
fact() {
  local key="$1" what="$2" cmd="$3" value
  value="$(eval "$cmd" 2>/dev/null | tr -d ' \r' | tail -n 1)"
  if printf '%s' "$value" | grep -Eq '^[0-9]+$'; then
    :
  else
    value="ERROR"
    BAD=$((BAD + 1))
    echo "  ERROR: the command for $key did not answer with a number: $cmd"
  fi
  printf 'N\t%s\t%s\t%s\t%s\n' "$key" "$what" "$value" "$cmd" >> "$WORK"
}

# list_fact KEY "what it lists" "command": the command answers with one item on each line.
list_fact() {
  local key="$1" what="$2" cmd="$3"
  printf 'L\t%s\t%s\t\t%s\n' "$key" "$what" "$cmd" >> "$WORK"
  eval "$cmd" 2>/dev/null | while IFS= read -r line; do
    if [ -n "$line" ]; then
      printf 'L\t%s\t%s\t%s\t%s\n' "$key" "$what" "$line" "$cmd" >> "$WORK"
    fi
  done
}

# The number that was counted for a key.
getn() {
  awk -F'\t' -v k="$1" '$1 == "N" && $2 == k { v = $4 } END { print v }' "$WORK"
}

# sum_fact KEY "what" KEY1 KEY2 ...: adds numbers that were counted before.
sum_fact() {
  local key="$1" what="$2" total=0 k v
  shift 2
  for k in "$@"; do
    v="$(getn "$k")"
    case "$v" in
      '' | ERROR) total="ERROR"; BAD=$((BAD + 1)); break ;;
    esac
    total=$((total + v))
  done
  printf 'N\t%s\t%s\t%s\t%s\n' "$key" "$what" "$total" "sum of: $*" >> "$WORK"
}

echo "Counting the project in $ROOT ..."

# --- Files and lines, by kind
fact files_ts "TypeScript files (.ts)" "$FIND -name '*.ts' $NOD -print | wc -l"
fact files_tsx "React files (.tsx)" "$FIND -name '*.tsx' -print | wc -l"
fact files_mts "TypeScript module files (.mts)" "$FIND -name '*.mts' $NOD -print | wc -l"
fact files_mjs "JavaScript module files (.mjs)" "$FIND -name '*.mjs' -print | wc -l"
fact files_css "Style sheets (.css)" "$FIND -name '*.css' -print | wc -l"
fact lines_ts "Lines in .ts files" "$FIND -name '*.ts' $NOD -exec cat {} + | wc -l"
fact lines_tsx "Lines in .tsx files" "$FIND -name '*.tsx' -exec cat {} + | wc -l"
fact lines_mts "Lines in .mts files" "$FIND -name '*.mts' $NOD -exec cat {} + | wc -l"
fact lines_mjs "Lines in .mjs files" "$FIND -name '*.mjs' -exec cat {} + | wc -l"
fact lines_css "Lines in .css files" "$FIND -name '*.css' -exec cat {} + | wc -l"
sum_fact files_code "Code files (.ts, .tsx, .mts, .mjs)" files_ts files_tsx files_mts files_mjs
sum_fact lines_code "Lines of code (.ts, .tsx, .mts, .mjs), blank lines and comments included" lines_ts lines_tsx lines_mts lines_mjs

# --- Files and lines, by folder (code files only)
fact files_app "Code files in app/" "find app $INDIR | wc -l"
fact lines_app "Lines of code in app/" "find app $INDIR -exec cat {} + | wc -l"
fact files_components "Code files in components/" "find components $INDIR | wc -l"
fact lines_components "Lines of code in components/" "find components $INDIR -exec cat {} + | wc -l"
fact files_lib "Code files in lib/" "find lib $INDIR | wc -l"
fact lines_lib "Lines of code in lib/" "find lib $INDIR -exec cat {} + | wc -l"
fact files_tests "Code files in __tests__/" "find __tests__ $INDIR | wc -l"
fact lines_tests "Lines of code in __tests__/" "find __tests__ $INDIR -exec cat {} + | wc -l"
fact files_scripts "Code files in scripts/" "find scripts $INDIR | wc -l"
fact lines_scripts "Lines of code in scripts/" "find scripts $INDIR -exec cat {} + | wc -l"

# --- Pages, actions and what is stored
fact pages "Pages (page.tsx files in app/)" "find app -type f -name 'page.tsx' | wc -l"
fact error_pages "Error and not-found pages in app/" "find app -type f \( -name 'not-found.tsx' -o -name 'error.tsx' -o -name 'global-error.tsx' \) | wc -l"
fact route_handlers "API route handlers (route.ts files in app/)" "find app -type f \( -name 'route.ts' -o -name 'route.tsx' \) | wc -l"
fact server_action_files "Files in app/ that are server actions" "grep -rl '\"use server\"' app | wc -l"
fact server_actions "Server actions (exported async functions in the files that are server actions)" "grep -rl '\"use server\"' app | while read -r f; do grep -h '^export async function' \"\$f\"; done | wc -l"
fact database_files "Database files (.sql, schema.prisma, .db, .sqlite)" "$FIND \( -name '*.sql' -o -name 'schema.prisma' -o -name '*.db' -o -name '*.sqlite' \) -print | wc -l"
fact components_tsx "Component files (.tsx in components/)" "find components -type f -name '*.tsx' | wc -l"
fact lib_modules "Modules in lib/ (.ts)" "find lib -type f -name '*.ts' $NOD | wc -l"
fact limit_rule_files "Speed-limit rule files in lib/ (*-limits.ts, without live-*)" "find lib -type f -name '*-limits.ts' -not -name 'live-*' | wc -l"
fact limit_counter_files "Speed-limit counters in lib/ (live-*-limits.ts)" "find lib -type f -name 'live-*-limits.ts' | wc -l"
fact icons "Icons drawn in components/icons.tsx" "grep -cE '^  [a-zA-Z]+: [(<]' components/icons.tsx"
fact security_headers "Security headers set in next.config.ts" "grep -c 'key: \"' next.config.ts"
fact aria_attributes "aria-* attributes written in app/ and components/" "grep -rhoE 'aria-[a-z]+=' app components | wc -l"

# --- Rules and limits, read from the code
fact post_kinds "Kinds of post" "awk '/export const postKindIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/post-kinds.ts | grep -o '\"[a-z-]*\"' | wc -l"
fact post_statuses "Statuses of a post" "awk '/export const postStatusIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/posts.ts | grep -o '\"[a-z-]*\"' | wc -l"
fact report_reasons "Reasons for a report" "awk '/export const reportReasonIds/ { go = 1 } go { print } go && /as const/ { exit }' lib/report-reasons.ts | grep -o '\"[a-z-]*\"' | wc -l"
fact sample_posts "Made-up sample posts in lib/posts.ts" "grep -c 'id: \"sample-' lib/posts.ts"
fact hide_after_days "Days after which a post that nobody touched is hidden" "sed -n 's/^export const hideAfterDays = \([0-9]*\);.*/\1/p' lib/post-age.ts"
fact saved_posts_limit "Posts the file may hold" "sed -n 's/^export const savedPostsLimit = \([0-9]*\);.*/\1/p' lib/post-store.ts"
fact reports_kept_per_post "Reports kept for one post" "sed -n 's/^export const reportsKeptPerPost = \([0-9]*\);.*/\1/p' lib/post-store.ts"
fact replies_kept_per_post "Replies kept for one post" "sed -n 's/^export const repliesKeptPerPost = \([0-9]*\);.*/\1/p' lib/new-reply.ts"
fact post_limit_per_visitor "Posts one visitor may save in an hour" "sed -n 's/^  perVisitor: \([0-9]*\),.*/\1/p' lib/post-limits.ts | head -n 1"
fact post_limit_per_site "Posts the whole site accepts in an hour" "sed -n 's/^  perSite: \([0-9]*\),.*/\1/p' lib/post-limits.ts | head -n 1"
fact manage_wrong_tries "Wrong tries on a private page, for one visitor" "sed -n 's/^  wrongTries: \([0-9]*\),.*/\1/p' lib/manage-limits.ts | head -n 1"
fact manage_window_minutes "Minutes a wrong try on a private page counts" "sed -n 's/^  windowMinutes: \([0-9]*\),.*/\1/p' lib/manage-limits.ts | head -n 1"
fact replies_per_hour "Replies one visitor may send in an hour" "sed -n 's/^  replies: \([0-9]*\),.*/\1/p' lib/reply-limits.ts | head -n 1"

# --- Tests (counted from the files; this tool does not run them)
fact test_files "Test files (*.test.ts and *.test.tsx in __tests__/)" "find __tests__ -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) | wc -l"
fact test_files_logic "Test files for rules and storage (*.test.ts)" "find __tests__ -type f -name '*.test.ts' | wc -l"
fact test_files_components "Test files for pages and components (*.test.tsx)" "find __tests__ -type f -name '*.test.tsx' | wc -l"
fact test_definitions "Tests written (lines that start a test or it call in __tests__/)" "grep -rEh '^[[:space:]]*(test|it)\(' __tests__ | wc -l"

# --- Packages and documents
fact dependencies "Packages in dependencies (package.json)" "node -e \"console.log(Object.keys(require('./package.json').dependencies).length)\""
fact dev_dependencies "Packages in devDependencies (package.json)" "node -e \"console.log(Object.keys(require('./package.json').devDependencies).length)\""
fact readme_lines "Lines in README.md" "wc -l < README.md"
fact readme_sections "Sections (## headings) in README.md" "grep -c '^## ' README.md"

# --- Lists
list_fact pages_list "Pages (page.tsx files in app/)" "find app -type f -name 'page.tsx' | sort"
list_fact special_files "Files in app/ that make robots.txt, the sitemap and the share image" "find app -maxdepth 1 -type f \( -name 'robots.ts' -o -name 'sitemap.ts' -o -name 'opengraph-image.tsx' \) | sort"
list_fact server_action_list "Server actions (exported async functions in the files that are server actions)" "grep -rl '\"use server\"' app | while read -r f; do grep -hoE '^export async function [A-Za-z]+' \"\$f\"; done | sed 's/^export async function //' | sort"
list_fact npm_scripts "Scripts in package.json" "node -e \"const s=require('./package.json').scripts;for(const k of Object.keys(s))console.log(k+': '+s[k])\""
list_fact quick_start "Quick start commands, as written in README.md" "sed -n '/^## Quick start/,/^| Command/p' README.md | grep '^    ' | sed 's/^    //'"
list_fact dev_address "Address of the site in development, as written in README.md" "grep -o 'http://localhost:[0-9]*' README.md | head -n 1"
list_fact setting_names "Settings the server reads, as listed in README.md (names only)" "sed -n 's/^| .\([A-Z][A-Z_]*\). |.*/\1/p' README.md"

if [ "$BAD" -gt 0 ]; then
  echo "$BAD count(s) failed. Nothing was written."
  exit 1
fi

node - "$WORK" "$ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
// The two paths come as the last two arguments.
const work = process.argv[process.argv.length - 2];
const root = process.argv[process.argv.length - 1];
const tab = String.fromCharCode(9);
const tick = String.fromCharCode(96);

// What the shell counted: numbers (N) and lists (L).
const numbers = [];
const lists = {};
const listOrder = [];
for (const line of fs.readFileSync(work, "utf8").split("\n")) {
  if (line === "") continue;
  const p = line.split(tab);
  if (p[0] === "N") {
    numbers.push({ key: p[1], what: p[2], value: Number(p[3]), command: p[4] });
  } else if (p[0] === "L") {
    if (lists[p[1]] === undefined) {
      lists[p[1]] = { key: p[1], what: p[2], command: p[4], items: [] };
      listOrder.push(p[1]);
    }
    if (p[3].length > 0) lists[p[1]].items.push(p[3]);
  }
}
const n = {};
for (const item of numbers) n[item.key] = item.value;
const listItems = (key) => (lists[key] === undefined ? [] : lists[key].items);

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// The address of each page, worked out from the folders in app/.
const routes = listItems("pages_list").map((file) => {
  const route = "/" + file.replace(/^app\//, "").replace(/\/?page\.tsx$/, "");
  return { route: route, file: file };
});
routes.sort((a, b) => a.route.localeCompare(b.route));
const specialRoute = { "robots.ts": "/robots.txt", "sitemap.ts": "/sitemap.xml", "opengraph-image.tsx": "/opengraph-image" };
for (const file of listItems("special_files")) {
  routes.push({ route: specialRoute[path.basename(file)], file: file });
}
routes.sort((a, b) => a.route.localeCompare(b.route));

// What the project does. Each line points to the file that does it, and the tool
// checks that the file is there.
const days = n.hide_after_days;
const featureLines = [
  ["Read the board of posts and filter it by kind (Help wanted, Offer, Lend)", "app/board/page.tsx"],
  ["Write a post; the server checks it again before it saves it to one JSON file", "app/board/new/actions.ts"],
  ["No accounts: each post gets a secret key, and only a SHA-256 fingerprint of it is saved", "lib/manage-key.ts"],
  ["A private page for the author: edit the post, change its status, read replies, see report counts, take it down", "app/board/[id]/manage/page.tsx"],
  ["A post nobody touches for " + days + " days is hidden from the board, never deleted; the author can keep it up", "lib/post-age.ts"],
  ["Neighbors reply privately; only the author reads the replies", "app/board/[id]/reply-actions.ts"],
  ["Visitors report a post with a reason, never a name", "app/board/[id]/actions.ts"],
  ["Speed limits on every public action, counted in the memory of the running server", "lib/rate-limit.ts"],
  ["A command-line tool that lists reports and takes posts down, with a backup first", "scripts/moderate.mjs"],
  ["Light and dark theme from CSS variables", "app/globals.css"],
  ["Safe headers on every page, and no X-Powered-By header", "next.config.ts"],
  ["A share image that is drawn when the site is built", "app/opengraph-image.tsx"],
  ["robots.txt and a sitemap that leaves out every post", "app/sitemap.ts"],
];
const features = featureLines.map((f) => ({ text: f[0], evidence: f[1], evidence_exists: fs.existsSync(path.join(root, f[1])) }));

const project = {
  name: pkg.name,
  version: pkg.version,
  type: "Web app: one Next.js project that holds the pages, the server actions and the storage, plus a small command-line tool for the person who runs the site.",
  languages: ["TypeScript", "CSS", "JavaScript (one Node.js script)"],
  packages: { dependencies: pkg.dependencies, devDependencies: pkg.devDependencies },
  storage: "One JSON file (data/posts.json). No database.",
  problem: "Neighbors need a simple place to ask for help, offer help and lend things, without accounts and without showing an exact address.",
  who_uses_it: "People who live near each other (from README.md).",
  where_to_see_it: { address_in_development: listItems("dev_address")[0], routes: routes },
  how_to_run: { quick_start: listItems("quick_start"), scripts: listItems("npm_scripts"), settings: listItems("setting_names") },
};

// What this tool cannot know. The author fills these in.
const notCounted = {
  commits_and_contributors: "TODO: this tool never runs the version-control program. Count them yourself if you want to show them.",
  test_run: "TODO: run the tests and write the summary line here. This tool counts the tests in the files; it does not run them.",
  build_and_lint_run: "TODO: run the build and the lint and write the result here.",
  live_demo: "TODO: there is no public demo yet. Write its address here when there is one.",
};

const today = new Date().toISOString().slice(0, 10);
const out = path.join(root, "portfolio");

// facts.txt
let txt = "";
for (const item of numbers) txt += item.key + "=" + item.value + "\n";
fs.writeFileSync(path.join(out, "facts.txt"), txt);

// facts.json
const numbersByKey = {};
for (const item of numbers) numbersByKey[item.key] = { what: item.what, value: item.value, command: item.command };
const listsByKey = {};
for (const key of listOrder) listsByKey[key] = { what: lists[key].what, items: lists[key].items, command: lists[key].command };
const facts = {
  counted_on: today,
  note: "Every number was counted by the command written next to it, inside the project folder. Left out of every count: node_modules, hidden folders, data/, portfolio/, coverage/ and *.d.ts files.",
  project: project,
  features: features,
  numbers: numbersByKey,
  lists: listsByKey,
  not_counted: notCounted,
};
fs.writeFileSync(path.join(out, "facts.json"), JSON.stringify(facts, null, 2) + "\n");

// facts.md
let md = "# Facts about " + pkg.name + "\n\n";
md += "Counted on " + today + ". Every number was counted by the command next to it, run inside the project folder. ";
md += "Left out of every count: node_modules, hidden folders, data/, portfolio/, coverage/ and *.d.ts files.\n\n";
md += "This file is made by " + tick + "bash portfolio/tools/facts.sh" + tick + ". Do not edit it by hand: run the tool again.\n\n";
md += "## Numbers\n\n";
for (const item of numbers) {
  md += "- **" + item.what + ": " + item.value + "**\n";
  md += "  Command: " + tick + item.command + tick + "\n";
}
md += "\n## Pages and addresses\n\n";
for (const r of routes) md += "- " + tick + r.route + tick + " from " + tick + r.file + tick + "\n";
md += "\n## What the project does, and where\n\n";
for (const f of features) md += "- " + f.text + " (" + tick + f.evidence + tick + (f.evidence_exists ? "" : ", FILE NOT FOUND") + ")\n";
md += "\n## Server actions\n\n";
for (const name of listItems("server_action_list")) md += "- " + tick + name + tick + "\n";
md += "\n## Scripts in package.json\n\n";
for (const s of listItems("npm_scripts")) md += "- " + tick + s + tick + "\n";
md += "\n## Not counted: the author fills these in\n\n";
for (const key of Object.keys(notCounted)) md += "- " + notCounted[key] + "\n";
fs.writeFileSync(path.join(out, "facts.md"), md);

const missing = features.filter((f) => f.evidence_exists === false);
if (missing.length > 0) {
  console.log("  WARNING: a file named in the list of features was not found: " + missing.map((f) => f.evidence).join(", "));
}
NODE
NODE_RC=$?
if [ "$NODE_RC" -ne 0 ]; then
  echo "The facts could not be written."
  exit 1
fi

echo
echo "Counted. Written: portfolio/facts.txt, portfolio/facts.json, portfolio/facts.md"
echo
awk -F= '{ printf "  %-26s %s\n", $1, $2 }' "$ROOT/portfolio/facts.txt"

# --- check: are these the numbers the texts use?
if [ "$MODE" = "check" ]; then
  EXPECTED="$TOOLS/facts-expected.txt"
  if [ -f "$EXPECTED" ]; then
    :
  else
    echo
    echo "Cannot check: the file portfolio/tools/facts-expected.txt is missing."
    exit 1
  fi
  echo
  echo "Checking against portfolio/tools/facts-expected.txt (the numbers the texts use):"
  DIFF=0
  SEEN=0
  while IFS='=' read -r key want; do
    case "$key" in
      '' | '#'*) continue ;;
    esac
    SEEN=$((SEEN + 1))
    got="$(grep "^$key=" "$ROOT/portfolio/facts.txt" | head -n 1 | cut -d= -f2)"
    if [ "$got" = "$want" ]; then
      echo "  same       $key = $got"
    else
      echo "  DIFFERENT  $key: yours $got, the texts use $want"
      DIFF=$((DIFF + 1))
    fi
  done < "$EXPECTED"
  if [ "$SEEN" -eq 0 ]; then
    echo "Cannot check: portfolio/tools/facts-expected.txt has no numbers in it."
    exit 1
  fi
  if [ "$DIFF" -gt 0 ]; then
    echo
    echo "$DIFF number(s) differ. Your project is not exactly the project the texts were written for."
    echo "Nothing is wrong with your files: tell me, and I will write the texts with your numbers."
    exit 3
  fi
  echo
  echo "All numbers are the ones the texts use."
fi
exit 0
