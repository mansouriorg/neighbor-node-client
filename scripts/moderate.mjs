// A small tool for the person who runs Neighbor Node. It looks at the reports
// that visitors sent and can take a post down.
//
// It works on the file where the board keeps its posts, data/posts.json in the
// folder where you run it. It needs no packages, only Node.js:
//
//   node scripts/moderate.mjs                          how to use it
//   node scripts/moderate.mjs list                     the posts that were reported
//   node scripts/moderate.mjs show POST-ID             one post with its reports
//   node scripts/moderate.mjs take-down POST-ID        a preview, nothing changes
//   node scripts/moderate.mjs take-down POST-ID --yes  do it
//
// Taking a post down does the same as the author does with the private link:
// the entry gets a field removedAt, and nothing else changes. Before that, the
// whole file is copied to a backup next to it.

import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// These lists and rules are copies of the ones in lib/. A script that anyone can
// run with plain Node cannot import TypeScript files. The tests compare the
// copies with the originals, so they cannot drift apart without a test failing.
export const reasonIds = ["spam", "private", "scam", "unsafe", "other"];
export const kindIds = ["help", "offer", "lend"];
export const statusIds = ["open", "in-progress", "done"];
const storeVersion = 1;
const idPattern = /^post-[A-Za-z0-9_-]{1,64}$/;
const fingerprintPattern = /^[0-9a-f]{64}$/;

const helpLines = [
  "Neighbor Node: look at reports and take posts down.",
  "This tool is for the person who runs the site. It works on the file",
  "data/posts.json in the folder where you run it.",
  "",
  "How to use it:",
  "  node scripts/moderate.mjs list",
  "      The posts that were reported and are still shown, most reports first.",
  "  node scripts/moderate.mjs show POST-ID",
  "      One post, with the time and the reason of each report.",
  "  node scripts/moderate.mjs take-down POST-ID",
  "      A preview of taking the post down. Nothing is changed.",
  "  node scripts/moderate.mjs take-down POST-ID --yes",
  "      Takes the post down. A backup of the file is made first.",
  "",
  "Options:",
  "  --file PATH   use another posts file than data/posts.json",
  "  --help        show this text",
  "",
  "The reasons are: " + reasonIds.join(", ") + ".",
];

function isRecord(value) {
  return value instanceof Object && Array.isArray(value) === false;
}

function isDateText(value) {
  return (
    typeof value === "string" && Number.isNaN(new Date(value).getTime()) === false
  );
}

function isReport(value) {
  return isRecord(value) && reasonIds.includes(value.reason) && isDateText(value.at);
}

// The same rules as isStoredReply in lib/post-store.ts: a message, maybe a name
// and a contact, and a time. The tool never prints a reply, because replies are
// meant for the author of the post. It only has to understand the file.
function isReply(value) {
  return (
    isRecord(value) &&
    typeof value.message === "string" &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.contact === undefined || typeof value.contact === "string") &&
    isDateText(value.at)
  );
}

// The same rules as isStoredPost in lib/post-store.ts.
function isEntry(value) {
  if (isRecord(value) === false) return false;
  const {
    id,
    kind,
    title,
    details,
    area,
    status,
    createdAt,
    manageKeyHash,
    removedAt,
    editedAt,
    renewedAt,
    reports,
    replies,
  } = value;
  return (
    typeof id === "string" &&
    id.length > 0 &&
    kindIds.includes(kind) &&
    typeof title === "string" &&
    typeof details === "string" &&
    typeof area === "string" &&
    statusIds.includes(status) &&
    isDateText(createdAt) &&
    (manageKeyHash === undefined ||
      (typeof manageKeyHash === "string" && fingerprintPattern.test(manageKeyHash))) &&
    (removedAt === undefined || isDateText(removedAt)) &&
    (editedAt === undefined || isDateText(editedAt)) &&
    (renewedAt === undefined || isDateText(renewedAt)) &&
    (reports === undefined || (Array.isArray(reports) && reports.every(isReport))) &&
    (replies === undefined || (Array.isArray(replies) && replies.every(isReply)))
  );
}

// Reads the text of the posts file. It says what is wrong with a damaged file
// and never repairs it.
export function parsePosts(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: "The posts file is not valid JSON." };
  }
  if (isRecord(data) && data.version === storeVersion && Array.isArray(data.posts)) {
    const bad = data.posts.findIndex((entry) => isEntry(entry) === false);
    if (bad >= 0) {
      return {
        ok: false,
        message: `Post number ${bad + 1} in the posts file is not in the right shape.`,
      };
    }
    return { ok: true, posts: data.posts };
  }
  return {
    ok: false,
    message:
      'The posts file should hold an object like { "version": 1, "posts": [] }. This tool only understands version 1.',
  };
}

// The text of the file, written exactly like lib/post-store.ts writes it.
export function serialize(posts) {
  return JSON.stringify({ version: storeVersion, posts }, null, 2) + "\n";
}

// Posts are written by visitors. Before their words go to your terminal, every
// control character is replaced, so a title cannot send commands to it.
function plain(text, keepLines = false) {
  let result = "";
  for (const char of String(text)) {
    const code = char.codePointAt(0);
    if (char === "\r") continue;
    if (char === "\n" && keepLines) {
      result += char;
    } else if (
      code < 32 ||
      (code >= 127 && code <= 159) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2066 && code <= 0x2069)
    ) {
      result += " ";
    } else {
      result += char;
    }
  }
  return result;
}

function short(text, most) {
  const letters = Array.from(plain(text));
  return letters.length > most ? letters.slice(0, most - 3).join("") + "..." : letters.join("");
}

function timeText(iso) {
  return new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

function isTakenDown(entry) {
  return typeof entry.removedAt === "string";
}

function reportsOf(entry) {
  return entry.reports === undefined ? [] : entry.reports;
}

function reasonProblem(error) {
  return error instanceof Error ? error.message : "Unknown problem.";
}

function hasCode(error, code) {
  return error instanceof Object && "code" in error && error.code === code;
}

// Splits the words after the name of the script into a command, an id and options.
function parseArguments(argv) {
  const found = { command: "", id: "", file: "", yes: false, help: false, problem: "" };
  const words = [];
  for (let index = 0; index < argv.length; index += 1) {
    const word = argv[index];
    if (word === "--yes") {
      found.yes = true;
    } else if (word === "--help" || word === "-h") {
      found.help = true;
    } else if (word === "--file" || word.startsWith("--file=")) {
      const value = word === "--file" ? argv[index + 1] : word.slice(7);
      if (typeof value === "string" && value.length > 0 && value.startsWith("--") === false) {
        found.file = value;
        if (word === "--file") index += 1;
      } else {
        found.problem = "--file needs the path of a posts file after it.";
        return found;
      }
    } else if (word.startsWith("-")) {
      found.problem = `Unknown option: ${short(word, 30)}`;
      return found;
    } else {
      words.push(word);
    }
  }
  if (words.length > 2) {
    found.problem = "Too many words. Use a command and, where needed, one post id.";
    return found;
  }
  found.command = words.length > 0 ? words[0] : "";
  found.id = words.length > 1 ? words[1] : "";
  return found;
}

// Says what is wrong with the way the command was used, or gives back "".
function useProblem(options) {
  const needsId = options.command === "show" || options.command === "take-down";
  if (options.command === "list") {
    if (options.id.length > 0) return "list needs no post id.";
  } else if (needsId === false) {
    return `Unknown command: ${short(options.command, 30)}`;
  } else if (options.id.length === 0) {
    return `${options.command} needs the id of a post, for example post-abc123. Run list to see the ids.`;
  } else if (idPattern.test(options.id) === false) {
    return "That is not the id of a saved post. Ids look like post-abc123. Run list to see them.";
  }
  const isTakeDown = options.command === "take-down";
  if (options.yes && isTakeDown === false) {
    return "--yes goes only with take-down.";
  }
  return "";
}

// The posts file, read and checked.
async function load(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (hasCode(error, "ENOENT")) {
      return {
        ok: false,
        message: `There is no posts file at ${file}. Either nobody has saved a post yet, or you are not in the project folder.`,
      };
    }
    return { ok: false, message: `Could not read ${file}: ${reasonProblem(error)}` };
  }
  const parsed = parsePosts(text);
  if (parsed.ok === false) {
    return {
      ok: false,
      message: `${parsed.message} Nothing was changed. Fix the file or move it away.`,
    };
  }
  return { ok: true, text, posts: parsed.posts };
}

function countsText(entry) {
  return reasonIds
    .map((reason) => ({
      reason,
      count: reportsOf(entry).filter((report) => report.reason === reason).length,
    }))
    .filter((item) => item.count > 0)
    .map((item) => `${item.reason} ${item.count}`)
    .join(", ");
}

function lastReportTime(entry) {
  return Math.max(...reportsOf(entry).map((report) => new Date(report.at).getTime()));
}

function listCommand(posts, out) {
  const rows = posts
    .filter((entry) => isTakenDown(entry) === false && reportsOf(entry).length > 0)
    .sort(
      (first, second) =>
        reportsOf(second).length - reportsOf(first).length ||
        lastReportTime(second) - lastReportTime(first),
    );
  if (rows.length === 0) {
    out("Nobody has reported a post that is still shown.");
    return;
  }
  out(`${rows.length} reported ${rows.length === 1 ? "post" : "posts"}, most reports first:`);
  for (const entry of rows) {
    const total = reportsOf(entry).length;
    out("");
    out(`${plain(entry.id)}  "${short(entry.title, 60)}"`);
    out(`  ${total} ${total === 1 ? "report" : "reports"}: ${countsText(entry)}`);
    out(`  last report: ${timeText(new Date(lastReportTime(entry)).toISOString())}`);
  }
  out("");
  out("Read one with:  node scripts/moderate.mjs show POST-ID");
}

function showCommand(entry, out) {
  out(`id:       ${plain(entry.id)}`);
  out(`title:    ${plain(entry.title)}`);
  out(`kind:     ${entry.kind}`);
  out(`status:   ${entry.status}`);
  out(`area:     ${plain(entry.area)}`);
  out(`posted:   ${timeText(entry.createdAt)}`);
  out(
    isTakenDown(entry)
      ? `shown:    no, taken down ${timeText(entry.removedAt)}`
      : "shown:    yes",
  );
  out("details:");
  for (const line of plain(entry.details, true).split("\n")) {
    out(line.length > 0 ? `  ${line}` : "");
  }
  const reports = reportsOf(entry);
  out(`reports:  ${reports.length}`);
  reports.forEach((report, place) => {
    out(`  ${place + 1}. ${timeText(report.at)}  ${report.reason}`);
  });
}

// Saves a copy of the old text next to the file. It never overwrites a copy.
async function saveCopy(file, text, now) {
  const stamp = now.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  for (let number = 1; number <= 9; number += 1) {
    const target = `${file}.before-take-down-${stamp}${number === 1 ? "" : `-${number}`}`;
    try {
      await writeFile(target, text, { encoding: "utf8", flag: "wx" });
      return target;
    } catch (error) {
      if (hasCode(error, "EEXIST") === false) throw error;
    }
  }
  throw new Error("Could not find a free name for the backup copy.");
}

// Writes a new file next to the old one, then renames it over the old one, like
// lib/post-store.ts does. A rename is all or nothing.
async function saveFile(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, text, "utf8");
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function takeDownCommand(loaded, options, file, now, out) {
  const matches = loaded.posts.filter((entry) => entry.id === options.id);
  if (matches.length === 0) {
    out(`Problem: no post with the id ${options.id} in the posts file.`);
    return 1;
  }
  if (matches.length > 1) {
    out(`Problem: ${matches.length} posts have the id ${options.id}. Nothing was changed. Fix the file by hand.`);
    return 1;
  }
  const entry = matches[0];
  if (isTakenDown(entry)) {
    out(`This post was taken down already, on ${timeText(entry.removedAt)}. Nothing was changed.`);
    return 0;
  }
  const total = reportsOf(entry).length;
  out(`post:     ${plain(entry.id)}  "${short(entry.title, 60)}"`);
  out(`reports:  ${total}${total > 0 ? " (" + countsText(entry) + ")" : ""}`);
  if (options.yes === false) {
    const again = options.file.length > 0 ? ` --file "${options.file}"` : "";
    out("");
    out("This is only a preview. Nothing was changed.");
    out("With --yes, the tool would:");
    out("  1. copy the posts file to a backup next to it (its name starts with");
    out(`     ${file}.before-take-down-)`);
    out("  2. add the time to this post as removedAt, and change nothing else");
    out("The post would leave the board and its own page, and the private link of its");
    out("author would stop working. The entry stays in the file.");
    out("");
    out(`To do it:  node scripts/moderate.mjs take-down ${options.id}${again} --yes`);
    return 0;
  }
  let backup;
  try {
    backup = await saveCopy(file, loaded.text, now);
  } catch (error) {
    out(`Problem: could not save the backup: ${reasonProblem(error)} Nothing was changed.`);
    return 1;
  }
  const marked = loaded.posts.map((item) =>
    item === entry ? { ...item, removedAt: now.toISOString() } : item,
  );
  try {
    await saveFile(file, serialize(marked));
  } catch (error) {
    out(`Problem: could not save the posts file: ${reasonProblem(error)}`);
    out(`The posts file was not changed. The backup is at ${backup}`);
    return 1;
  }
  out("");
  out("Done. The post is taken down.");
  out(`Backup of the file as it was before: ${backup}`);
  out("The post is gone from the board and from its own page. The private link of its");
  out("author does not work any more.");
  out("To undo it, copy the backup over the posts file while nobody saves a post. A post");
  out("saved after this moment would be lost by that. See the README for other ways.");
  return 0;
}

// Runs one command. argv is what comes after the name of the script. io can give
// another way to print (out), another clock (now) and another folder (cwd), which
// the tests use. It gives back the exit code: 0 all fine, 1 a problem with the
// posts, 2 the command was used wrongly.
export async function run(argv, io = {}) {
  const out =
    io.out === undefined
      ? (line) => {
          process.stdout.write(`${line}\n`);
        }
      : io.out;
  const now = io.now === undefined ? () => new Date() : io.now;
  const cwd = io.cwd === undefined ? process.cwd() : io.cwd;
  const options = parseArguments(argv);
  if (options.problem.length > 0) {
    out(`Problem: ${options.problem}`);
    out("Run the tool without any words to see how to use it.");
    return 2;
  }
  if (options.help || options.command.length === 0) {
    for (const line of helpLines) out(line);
    return 0;
  }
  const problem = useProblem(options);
  if (problem.length > 0) {
    out(`Problem: ${problem}`);
    out("Run the tool without any words to see how to use it.");
    return 2;
  }
  const file = options.file.length > 0 ? resolve(cwd, options.file) : join(cwd, "data", "posts.json");
  out(`Posts file: ${file}`);
  const loaded = await load(file);
  if (loaded.ok === false) {
    out(`Problem: ${loaded.message}`);
    return 1;
  }
  if (options.command === "list") {
    out("");
    listCommand(loaded.posts, out);
    return 0;
  }
  if (options.command === "show") {
    const entry = loaded.posts.find((item) => item.id === options.id);
    if (entry === undefined) {
      out(`Problem: no post with the id ${options.id} in the posts file.`);
      return 1;
    }
    out("");
    showCommand(entry, out);
    return 0;
  }
  out("");
  return takeDownCommand(loaded, options, file, now(), out);
}

// Starts the tool only when node runs this file, not when a test imports it.
function isStartedByNode() {
  try {
    return (
      typeof import.meta.url === "string" &&
      typeof process.argv[1] === "string" &&
      realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)
    );
  } catch {
    return false;
  }
}

if (isStartedByNode()) {
  // When the reader stops early, for example with "| head", stop quietly.
  process.stdout.on("error", (error) => {
    if (hasCode(error, "EPIPE") === false) process.exitCode = 1;
  });
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stdout.write(`Problem: ${reasonProblem(error)}\n`);
      process.exitCode = 1;
    },
  );
}
