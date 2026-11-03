import { execFile } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "vitest";
import { postKindIds } from "@/lib/post-kinds";
import {
  addPost,
  addReport,
  parseStoredPosts,
  readOwnPost,
  readPosts,
  removeOwnPost,
} from "@/lib/post-store";
import { postStatusIds } from "@/lib/posts";
import { reportReasonIds, type ReportReason } from "@/lib/report-reasons";
import {
  kindIds,
  parsePosts,
  reasonIds,
  run,
  serialize,
  statusIds,
} from "@/scripts/moderate.mjs";
import { useTempFolders } from "./support/temp-folders";

const makeFolder = useTempFolders("moderate-script-");

const sofa = {
  kind: "help",
  title: "Help moving a sofa",
  details: "Saturday morning, two people, about an hour.",
  area: "Olive Street",
} as const;

const noon = new Date(2026, 9, 25, 12, 0, 0);
const earlier = new Date(Date.UTC(2026, 9, 26, 9, 30, 0));
const later = new Date(Date.UTC(2026, 9, 27, 8, 0, 0));
const taken = new Date(Date.UTC(2026, 9, 31, 11, 55, 7));
const backupName = "posts.json.before-take-down-20261031-115507";
const scriptPath = join(process.cwd(), "scripts", "moderate.mjs");

// A folder like the project folder, with the place where the posts file lives.
async function projectFolder() {
  const folder = await makeFolder();
  return { folder, file: join(folder, "data", "posts.json") };
}

// Saves a post and gives back its id and the secret key of its private link.
async function save(file: string, title: string) {
  const result = await addPost({ ...sofa, title }, file, noon);
  if (result.ok === false) throw new Error("The board of the test is full.");
  return { id: result.post.id, key: result.manageKey };
}

async function report(file: string, id: string, reason: ReportReason, when: Date) {
  const result = await addReport(id, reason, file, when);
  expect(result).toEqual({ ok: true, stored: true });
}

// Runs the tool in the folder with a fixed clock and gives back what it printed.
async function tool(folder: string, args: string[], when: Date = taken) {
  const lines: string[] = [];
  const code = await run(args, {
    out: (line) => {
      lines.push(line);
    },
    now: () => when,
    cwd: folder,
  });
  return { code, text: lines.join("\n") };
}

// Runs the script as a real program, the way you run it in a terminal.
function program(folder: string, args: string[], script: string = scriptPath) {
  return new Promise<{ code: number; text: string }>((finish) => {
    execFile(process.execPath, [script, ...args], { cwd: folder }, (error, stdout) => {
      const code = error === null ? 0 : typeof error.code === "number" ? error.code : -1;
      finish({ code, text: stdout });
    });
  });
}

async function rawPosts(file: string) {
  return JSON.parse(await readFile(file, "utf8")).posts;
}

async function names(folder: string) {
  return (await readdir(folder)).sort();
}

function validEntry(id: string, more: Record<string, unknown> = {}) {
  return {
    id,
    kind: "help",
    title: "An older post here",
    details: "Saturday morning, two people, about an hour.",
    area: "Olive Street",
    status: "open",
    createdAt: "2026-01-01T10:00:00.000Z",
    ...more,
  };
}

function fileWith(entries: unknown[]): string {
  return JSON.stringify({ version: 1, posts: entries }, null, 2) + "\n";
}

async function writeRaw(file: string, text: string) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

test("without words, or with --help, the tool says how to use it and touches nothing", async () => {
  const { folder } = await projectFolder();
  for (const args of [[], ["--help"], ["list", "-h"]]) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(0);
    expect(answer.text).toContain("node scripts/moderate.mjs list");
    expect(answer.text).toContain("node scripts/moderate.mjs show POST-ID");
    expect(answer.text).toContain("node scripts/moderate.mjs take-down POST-ID --yes");
    expect(answer.text).toContain("spam, private, scam, unsafe, other");
  }
  expect(await names(folder)).toEqual([]);
});

test("a command that is used wrongly gets code 2 and a plain reason, and the file is not touched", async () => {
  const { folder, file } = await projectFolder();
  await save(file, "The first post here");
  const before = await readFile(file, "utf8");
  const wrong: [string[], string][] = [
    [["frobnicate"], "Unknown command"],
    [["list", "post-abc"], "list needs no post id"],
    [["show"], "needs the id of a post"],
    [["take-down"], "needs the id of a post"],
    [["show", "sample-1"], "not the id of a saved post"],
    [["list", "--nope"], "Unknown option"],
    [["list", "--yes"], "--yes goes only with take-down"],
    [["show", "post-abc", "--yes"], "--yes goes only with take-down"],
    [["take-down", "post-abc", "extra"], "Too many words"],
    [["list", "--file"], "--file needs the path"],
    [["list", "--file", "--yes"], "--file needs the path"],
    [["list", "--file="], "--file needs the path"],
  ];
  for (const [args, words] of wrong) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(2);
    expect(answer.text).toContain("Problem:");
    expect(answer.text).toContain(words);
  }
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await names(join(folder, "data"))).toEqual(["posts.json"]);
});

test("an id that is not the shape of a post id is refused before the file is even opened", async () => {
  const { folder } = await projectFolder();
  const ids = ["post-a;rm", "../posts.json", "post-" + "a".repeat(65), "POST-1", "post-a b", "post-"];
  for (const id of ids) {
    for (const args of [["show", id], ["take-down", id], ["take-down", id, "--yes"]]) {
      const answer = await tool(folder, args);
      expect(answer.code).toBe(2);
      expect(answer.text).not.toContain("Posts file:");
    }
  }
  expect(await names(folder)).toEqual([]);
});

test("list shows the reported posts that are still shown, the one with most reports first", async () => {
  const { folder, file } = await projectFolder();
  const few = await save(file, "Reported once, early");
  const many = await save(file, "Reported three times");
  const none = await save(file, "Never reported");
  const gone = await save(file, "Reported, then taken down");
  const late = await save(file, "Reported once, late");
  await report(file, few.id, "other", earlier);
  await report(file, many.id, "scam", earlier);
  await report(file, many.id, "spam", later);
  await report(file, many.id, "scam", later);
  await report(file, gone.id, "unsafe", earlier);
  await report(file, late.id, "private", later);
  await removeOwnPost(gone.id, gone.key, file, later);
  const before = await readFile(file, "utf8");

  const answer = await tool(folder, ["list"]);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain(`Posts file: ${file}`);
  expect(answer.text).toContain("3 reported posts, most reports first:");
  const order = [many.id, late.id, few.id].map((id) => answer.text.indexOf(id));
  expect(order.every((place) => place > 0)).toBe(true);
  expect(order[0]).toBeLessThan(order[1]);
  expect(order[1]).toBeLessThan(order[2]);
  expect(answer.text).toContain(`${many.id}  "Reported three times"`);
  expect(answer.text).toContain("3 reports: spam 1, scam 2");
  expect(answer.text).toContain("1 report: private 1");
  expect(answer.text).toContain("last report: 2026-10-27 08:00 UTC");
  expect(answer.text).not.toContain(none.id);
  expect(answer.text).not.toContain(gone.id);
  expect(answer.text).toContain("node scripts/moderate.mjs show POST-ID");
  expect(await readFile(file, "utf8")).toBe(before);
});

test("list says so when no post that is still shown was reported", async () => {
  const { folder, file } = await projectFolder();
  const own = await save(file, "Never reported");
  const gone = await save(file, "Reported, then taken down");
  await report(file, gone.id, "spam", earlier);
  await removeOwnPost(gone.id, gone.key, file, later);
  const answer = await tool(folder, ["list"]);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("Nobody has reported a post that is still shown.");
  expect(answer.text).not.toContain(own.id);
  expect(answer.text).not.toContain(gone.id);
});

test("show prints the post, its details and each report with time and reason, the oldest first", async () => {
  const { folder, file } = await projectFolder();
  const { id } = await save(file, "Help moving a sofa");
  await report(file, id, "spam", earlier);
  await report(file, id, "private", later);
  const text = await readFile(file, "utf8");
  await writeRaw(file, text.replace("about an hour.", "about an hour.\\nBring gloves."));
  const answer = await tool(folder, ["show", id]);
  expect(answer.code).toBe(0);
  const lines = answer.text.split("\n");
  expect(lines).toContain(`id:       ${id}`);
  expect(lines).toContain("title:    Help moving a sofa");
  expect(lines).toContain("kind:     help");
  expect(lines).toContain("status:   open");
  expect(lines).toContain("area:     Olive Street");
  expect(lines).toContain("shown:    yes");
  expect(lines).toContain("  Saturday morning, two people, about an hour.");
  expect(lines).toContain("  Bring gloves.");
  expect(lines).toContain("reports:  2");
  expect(lines).toContain("  1. 2026-10-26 09:30 UTC  spam");
  expect(lines).toContain("  2. 2026-10-27 08:00 UTC  private");
  expect(answer.text).not.toContain("manageKeyHash");
});

test("show also shows a post that was taken down, and says so", async () => {
  const { folder, file } = await projectFolder();
  const { id, key } = await save(file, "Help moving a sofa");
  await removeOwnPost(id, key, file, later);
  const answer = await tool(folder, ["show", id]);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("shown:    no, taken down 2026-10-27 08:00 UTC");
});

test("show and take-down of an id that is not in the file say so, with code 1, and the file stays", async () => {
  const { folder, file } = await projectFolder();
  await save(file, "The first post here");
  const before = await readFile(file, "utf8");
  for (const args of [["show", "post-nothing"], ["take-down", "post-nothing", "--yes"]]) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(1);
    expect(answer.text).toContain("no post with the id post-nothing");
  }
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await names(join(folder, "data"))).toEqual(["posts.json"]);
});

test("take-down without --yes is only a preview: nothing changes and no backup is made", async () => {
  const { folder, file } = await projectFolder();
  const { id } = await save(file, "Help moving a sofa");
  await report(file, id, "scam", earlier);
  const before = await readFile(file, "utf8");
  const answer = await tool(folder, ["take-down", id]);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("This is only a preview. Nothing was changed.");
  expect(answer.text).toContain("reports:  1 (scam 1)");
  expect(answer.text).toContain(`To do it:  node scripts/moderate.mjs take-down ${id} --yes`);
  expect(await readFile(file, "utf8")).toBe(before);
  expect(await names(join(folder, "data"))).toEqual(["posts.json"]);
  const other = await tool(folder, ["take-down", id, "--file", "data/posts.json"]);
  expect(other.text).toContain(`take-down ${id} --file "data/posts.json" --yes`);
});

test("take-down --yes takes that post down and changes nothing else", async () => {
  const { folder, file } = await projectFolder();
  const first = await save(file, "The first post here");
  const target = await save(file, "The post that is reported");
  const last = await save(file, "The last post here");
  await report(file, target.id, "scam", earlier);
  await report(file, target.id, "scam", later);
  const before = await rawPosts(file);
  const answer = await tool(folder, ["take-down", target.id, "--yes"]);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("Done. The post is taken down.");

  const after = await rawPosts(file);
  expect(after.length).toBe(3);
  expect(after[0]).toEqual(before[0]);
  expect(after[2]).toEqual(before[2]);
  expect(after[1]).toEqual({ ...before[1], removedAt: taken.toISOString() });
  expect(after[1].reports.length).toBe(2);
  expect(JSON.parse(await readFile(file, "utf8")).version).toBe(1);

  const shown = (await readPosts(file, noon)).map((post) => post.id);
  expect(shown).toContain(first.id);
  expect(shown).toContain(last.id);
  expect(shown).not.toContain(target.id);
  expect(await readOwnPost(target.id, target.key, file)).toEqual({ ok: false, reason: "not-allowed" });
  expect((await readOwnPost(first.id, first.key, file)).ok).toBe(true);
  expect(await names(join(folder, "data"))).toEqual(["posts.json", backupName]);
});

test("the backup holds the old file exactly, and the new file is what the store writes when the author takes the post down", async () => {
  const { folder, file } = await projectFolder();
  await save(file, "The first post here");
  const target = await save(file, "The post that is reported");
  await report(file, target.id, "unsafe", earlier);
  const old = await readFile(file, "utf8");
  const sibling = join(folder, "sibling.json");
  await copyFile(file, sibling);

  await tool(folder, ["take-down", target.id, "--yes"]);
  await removeOwnPost(target.id, target.key, sibling, taken);

  expect(await readFile(join(folder, "data", backupName), "utf8")).toBe(old);
  expect(await readFile(file, "utf8")).toBe(await readFile(sibling, "utf8"));
});

test("a file that was written by hand is backed up exactly as it was, and the new file is the usual format", async () => {
  const { folder, file } = await projectFolder();
  const wanted = validEntry("post-by-hand", { reports: [{ reason: "other", at: earlier.toISOString() }] });
  const other = validEntry("post-other-one");
  const old = JSON.stringify({ version: 1, posts: [other, wanted] });
  await writeRaw(file, old);
  const answer = await tool(folder, ["take-down", "post-by-hand", "--yes"]);
  expect(answer.code).toBe(0);
  expect(await readFile(join(folder, "data", backupName), "utf8")).toBe(old);
  expect(await readFile(file, "utf8")).toBe(
    serialize([other, { ...wanted, removedAt: taken.toISOString() }]),
  );
});

test("taking the same post down again says so, changes nothing and makes no second backup", async () => {
  const { folder, file } = await projectFolder();
  const { id } = await save(file, "Help moving a sofa");
  await tool(folder, ["take-down", id, "--yes"]);
  const done = await readFile(file, "utf8");
  const answer = await tool(folder, ["take-down", id, "--yes"], later);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("taken down already, on 2026-10-31 11:55 UTC");
  expect(await readFile(file, "utf8")).toBe(done);
  expect(await names(join(folder, "data"))).toEqual(["posts.json", backupName]);
});

test("two take-downs in the same second keep both backups", async () => {
  const { folder, file } = await projectFolder();
  const first = await save(file, "The first post here");
  const second = await save(file, "The second post here");
  await tool(folder, ["take-down", first.id, "--yes"]);
  const middle = await readFile(file, "utf8");
  await tool(folder, ["take-down", second.id, "--yes"]);
  expect(await names(join(folder, "data"))).toEqual(["posts.json", backupName, `${backupName}-2`]);
  expect(await readFile(join(folder, "data", `${backupName}-2`), "utf8")).toBe(middle);
  expect(await readPosts(file, noon)).toEqual([]);
});

test("a damaged file, a wrong version or a wrong shape is never written, and no backup is made", async () => {
  const { folder, file } = await projectFolder();
  const id = "post-abc";
  const damaged = [
    "this is not json",
    JSON.stringify({ version: 2, posts: [] }),
    JSON.stringify({ version: 1 }),
    JSON.stringify([validEntry(id)]),
    fileWith([validEntry(id), { id: "post-two" }]),
    fileWith([validEntry(id, { removedAt: 5 })]),
  ];
  for (const text of damaged) {
    await writeRaw(file, text);
    for (const args of [["list"], ["show", id], ["take-down", id, "--yes"]]) {
      const answer = await tool(folder, args);
      expect(answer.code).toBe(1);
      expect(answer.text).toContain("Problem:");
      expect(answer.text).toContain("Nothing was changed. Fix the file or move it away.");
    }
    expect(await readFile(file, "utf8")).toBe(text);
    expect(await names(join(folder, "data"))).toEqual(["posts.json"]);
  }
});

test("two posts with the same id are not touched", async () => {
  const { folder, file } = await projectFolder();
  const text = fileWith([validEntry("post-same"), validEntry("post-same")]);
  await writeRaw(file, text);
  const answer = await tool(folder, ["take-down", "post-same", "--yes"]);
  expect(answer.code).toBe(1);
  expect(answer.text).toContain("2 posts have the id post-same");
  expect(await readFile(file, "utf8")).toBe(text);
  expect(await names(join(folder, "data"))).toEqual(["posts.json"]);
});

test("a missing file gets a friendly message, and nothing is created", async () => {
  const { folder } = await projectFolder();
  for (const args of [["list"], ["show", "post-abc"], ["take-down", "post-abc", "--yes"]]) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(1);
    expect(answer.text).toContain("There is no posts file at");
    expect(answer.text).toContain("not in the project folder");
  }
  expect(await names(folder)).toEqual([]);
});

test("--file works with a relative path, with =, and with an absolute path", async () => {
  const { folder } = await projectFolder();
  const elsewhere = join(folder, "elsewhere", "posts.json");
  const { id } = await save(elsewhere, "Help moving a sofa");
  await report(elsewhere, id, "other", earlier);
  for (const args of [
    ["list", "--file", "elsewhere/posts.json"],
    ["list", "--file=elsewhere/posts.json"],
    ["list", "--file", elsewhere],
  ]) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(0);
    expect(answer.text).toContain(`Posts file: ${elsewhere}`);
    expect(answer.text).toContain(id);
  }
  const done = await tool(folder, ["take-down", id, "--yes", "--file", "elsewhere/posts.json"]);
  expect(done.code).toBe(0);
  expect(await readPosts(elsewhere, noon)).toEqual([]);
  expect(await names(join(folder, "elsewhere"))).toEqual(["posts.json", backupName]);
  expect(await names(folder)).toEqual(["elsewhere"]);
});

test("the words of visitors cannot send commands to the terminal", async () => {
  const { folder, file } = await projectFolder();
  const mean = "Ladder \u001b[31mRED\u001b[0m \u0007bell \u202eevil\u0085 end";
  await writeRaw(
    file,
    fileWith([
      validEntry("post-mean", {
        title: mean,
        area: mean,
        details: mean + "\r\n" + mean,
        reports: [{ reason: "scam", at: earlier.toISOString() }],
      }),
    ]),
  );
  for (const args of [["list"], ["show", "post-mean"], ["take-down", "post-mean"]]) {
    const answer = await tool(folder, args);
    expect(answer.code).toBe(0);
    expect(answer.text).toContain("Ladder");
    const dangerous = [...answer.text].filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      const control = code < 10 || (code > 10 && code < 32) || (code >= 127 && code <= 159);
      return control || (code >= 0x202a && code <= 0x202e);
    });
    expect(dangerous).toEqual([]);
  }
});

test("the tool understands exactly the files that the store understands", () => {
  const key = "a".repeat(64);
  const texts = [
    fileWith([]),
    fileWith([validEntry("post-a")]),
    fileWith([validEntry("post-a", { manageKeyHash: key, removedAt: later.toISOString() })]),
    fileWith([validEntry("post-a", { reports: [{ reason: "scam", at: earlier.toISOString() }] })]),
    fileWith([validEntry("post-a", { reports: [] })]),
    "not json",
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, posts: {} }),
    JSON.stringify({ version: 3, posts: [] }),
    JSON.stringify([]),
    fileWith([null]),
    fileWith([validEntry("")]),
    fileWith([validEntry("post-a", { kind: "sell" })]),
    fileWith([validEntry("post-a", { status: "finished" })]),
    fileWith([validEntry("post-a", { title: 5 })]),
    fileWith([validEntry("post-a", { createdAt: "yesterday" })]),
    fileWith([validEntry("post-a", { manageKeyHash: "short" })]),
    fileWith([validEntry("post-a", { removedAt: "never" })]),
    fileWith([validEntry("post-a", { reports: "many" })]),
    fileWith([validEntry("post-a", { reports: [{ reason: "rude", at: earlier.toISOString() }] })]),
    fileWith([validEntry("post-a", { reports: [{ reason: "spam", at: "soon" }] })]),
  ];
  let accepted = 0;
  for (const text of texts) {
    let storeAccepts = true;
    try {
      parseStoredPosts(text);
    } catch {
      storeAccepts = false;
    }
    expect(parsePosts(text).ok).toBe(storeAccepts);
    if (storeAccepts) accepted += 1;
  }
  expect(accepted).toBe(5);
});

test("the lists in the tool are the lists of the app", () => {
  expect([...reasonIds]).toEqual([...reportReasonIds]);
  expect([...kindIds]).toEqual([...postKindIds]);
  expect([...statusIds]).toEqual([...postStatusIds]);
});

test("serialize writes the text exactly like the store does", async () => {
  const { file } = await projectFolder();
  const { id } = await save(file, "Help moving a sofa");
  await save(file, "Another post here");
  await report(file, id, "spam", earlier);
  const text = await readFile(file, "utf8");
  expect(serialize(JSON.parse(text).posts)).toBe(text);
  expect(serialize([])).toBe('{\n  "version": 1,\n  "posts": []\n}\n');
});

test("run as a real program, it lists, previews and takes a post down, and gives the right codes", async () => {
  const { folder, file } = await projectFolder();
  const { id } = await save(file, "Help moving a sofa");
  await save(file, "Another post here");
  await report(file, id, "scam", earlier);

  const listed = await program(folder, ["list"]);
  expect(listed.code).toBe(0);
  expect(listed.text).toContain(`${id}  "Help moving a sofa"`);
  const before = await readFile(file, "utf8");

  const preview = await program(folder, ["take-down", id]);
  expect(preview.code).toBe(0);
  expect(preview.text).toContain("only a preview");
  expect(await readFile(file, "utf8")).toBe(before);

  expect((await program(folder, ["list", "--yes"])).code).toBe(2);
  expect((await program(folder, ["show", "post-nothing"])).code).toBe(1);

  const done = await program(folder, ["take-down", id, "--yes"]);
  expect(done.code).toBe(0);
  expect((await readPosts(file, noon)).map((post) => post.title)).toEqual(["Another post here"]);
  const left = await names(join(folder, "data"));
  expect(left.length).toBe(2);
  expect(left[0]).toBe("posts.json");
  expect(left[1]).toMatch(/^posts\.json\.before-take-down-\d{8}-\d{6}$/);
});

test("run as a real program through a link to the script, it still starts", async () => {
  const { folder, file } = await projectFolder();
  await save(file, "Help moving a sofa");
  const link = join(folder, "linked-moderate.mjs");
  await symlink(scriptPath, link);
  const answer = await program(folder, ["list"], link);
  expect(answer.code).toBe(0);
  expect(answer.text).toContain("Nobody has reported a post that is still shown.");
});

test("when another program imports the script, it prints nothing and does nothing", async () => {
  const { folder } = await projectFolder();
  const address = pathToFileURL(scriptPath).href;
  const answer = await new Promise<{ code: number; text: string }>((finish) => {
    execFile(
      process.execPath,
      ["--input-type=module", "-e", `import ${JSON.stringify(address)};`],
      { cwd: folder },
      (error, stdout) => {
        finish({ code: error === null ? 0 : 1, text: stdout });
      },
    );
  });
  expect(answer).toEqual({ code: 0, text: "" });
  expect(await names(folder)).toEqual([]);
});
